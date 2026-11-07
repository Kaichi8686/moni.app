"""
backtest.py
-----------
過去3年分のバックテスト。

ルール:
- シグナルはその日の終値で判定
- 約定は翌営業日の始値
- 手数料・スリッページを必ず織り込む
- 未来のデータは使わない
- リスク管理（1銘柄上限・全体-15%停止）を通す

出力:
- 総リターン、最大ドローダウン、シャープレシオ、勝率、取引回数
- 戦略資産 vs 1306.T バイ＆ホールド の比較グラフ（output/ に保存）

動作確認:
    cd paper_trade
    python3 backtest.py
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from config import (
    BACKTEST_YEARS,
    BENCHMARK_TICKER,
    COMMISSION_RATE,
    INITIAL_CASH,
    MAX_POSITION_RATIO,
    OUTPUT_DIR,
    SLIPPAGE_RATE,
    TICKERS,
)
from data import get_benchmark_history, get_many_price_histories
from logging_utils import ensure_dir, get_logger, log_exception
from risk import check_portfolio_stop, clamp_buy_shares, max_shares_for_ticker
from strategy import explain_signal, get_strategy

logger = get_logger(__name__)


@dataclass
class TradeRecord:
    """バックテスト中の1取引。"""

    date: str
    ticker: str
    side: str
    price: float
    shares: int
    reason: str
    equity: float
    pnl: float = 0.0  # 売り約定時の損益（円）


@dataclass
class BacktestResult:
    """バックテスト結果のまとめ。"""

    equity_curve: pd.Series
    benchmark_curve: pd.Series
    trades: list[TradeRecord] = field(default_factory=list)
    total_return: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    win_rate: float = 0.0
    trade_count: int = 0
    stopped: bool = False
    stop_reason: str = ""
    chart_path: Path | None = None


def apply_slippage(price: float, side: str, slippage_rate: float = SLIPPAGE_RATE) -> float:
    """
    スリッページを反映した約定価格。

    - 買い: 少し高く買う
    - 売り: 少し安く売る
    """
    if side == "BUY":
        return price * (1.0 + slippage_rate)
    return price * (1.0 - slippage_rate)


def apply_commission(notional: float, commission_rate: float = COMMISSION_RATE) -> float:
    """売買代金に対する手数料。"""
    return abs(notional) * commission_rate


def _align_calendars(data: dict[str, pd.DataFrame]) -> pd.DatetimeIndex:
    """全銘柄で共通に使える営業日インデックス（積集合）を作る。"""
    indexes = [df.index for df in data.values() if df is not None and not df.empty]
    if not indexes:
        return pd.DatetimeIndex([])
    common = indexes[0]
    for idx in indexes[1:]:
        common = common.intersection(idx)
    return common.sort_values()


def _calc_max_drawdown(equity: pd.Series) -> float:
    """最大ドローダウン（負の値、例: -0.12）。"""
    if equity.empty:
        return 0.0
    peak = equity.cummax()
    dd = equity / peak - 1.0
    return float(dd.min())


def _calc_sharpe(equity: pd.Series, trading_days: int = 252) -> float:
    """日次リターンから年率換算シャープ（リスクフリー=0 と仮定）。"""
    if len(equity) < 2:
        return 0.0
    rets = equity.pct_change().dropna()
    if rets.std(ddof=0) == 0:
        return 0.0
    return float((rets.mean() / rets.std(ddof=0)) * (trading_days ** 0.5))


def _calc_win_rate(trades: list[TradeRecord]) -> float:
    """売り約定のうち、pnl > 0 の割合。"""
    sells = [t for t in trades if t.side == "SELL"]
    if not sells:
        return 0.0
    wins = sum(1 for t in sells if t.pnl > 0)
    return wins / len(sells)


def run_backtest(
    tickers: list[str] | None = None,
    years: int = BACKTEST_YEARS,
    initial_cash: float = INITIAL_CASH,
    save_chart: bool = True,
) -> BacktestResult:
    """
    メインのバックテスト実行関数。
    """
    if tickers is None:
        tickers = list(TICKERS)

    end = datetime.now()
    # 移動平均のウォームアップ分を多めに取る
    start = end - timedelta(days=365 * years + 200)
    start_str = start.strftime("%Y-%m-%d")
    end_str = (end + timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info("バックテスト開始: %s 〜 現在, 銘柄=%s", start_str, tickers)

    price_data = get_many_price_histories(tickers, start=start_str, end=end_str)
    bench = get_benchmark_history(start=start_str, end=end_str)

    # ベンチマークもカレンダー揃えに含める
    all_for_calendar = {**price_data, BENCHMARK_TICKER: bench}
    calendar = _align_calendars(all_for_calendar)
    if calendar.empty:
        logger.error("共通営業日が取れませんでした")
        empty = pd.Series(dtype=float)
        return BacktestResult(equity_curve=empty, benchmark_curve=empty)

    # バックテスト本体の開始日（years 年前以降、かつ長期MAが使える頃）
    bt_start = pd.Timestamp((end - timedelta(days=365 * years)).strftime("%Y-%m-%d"))
    calendar = calendar[calendar >= price_data[tickers[0]].index.min()]

    strategy = get_strategy()

    # 銘柄ごとのシグナル（終値ベース）を事前計算
    signals: dict[str, pd.Series] = {}
    for t in tickers:
        try:
            signals[t] = strategy(price_data[t])
        except Exception as e:
            log_exception(logger, f"シグナル計算失敗 ({t})", e)
            signals[t] = pd.Series(0, index=price_data[t].index, dtype=int)

    cash = float(initial_cash)
    # 保有: ticker -> {"shares": int, "avg_price": float}
    positions: dict[str, dict[str, float]] = {}
    # 前日終値で立てた予約: 翌営業日始値で約定
    pending: list[dict] = []

    equity_points: list[tuple[pd.Timestamp, float]] = []
    trades: list[TradeRecord] = []
    stopped = False
    stop_reason = ""

    dates = list(calendar)
    for i, dt in enumerate(dates):
        # ---- 1) 予約注文を「当日始値」で約定 ----
        still_pending: list[dict] = []
        for order in pending:
            t = order["ticker"]
            if t not in price_data or dt not in price_data[t].index:
                still_pending.append(order)
                continue
            # シグナル日より後の営業日で初めて約定
            if dt <= pd.Timestamp(order["signal_date"]):
                still_pending.append(order)
                continue

            open_price = float(price_data[t].loc[dt, "Open"])
            side = order["side"]
            shares = int(order["shares"])
            reason = order["reason"]

            try:
                fill_price = apply_slippage(open_price, side)
                if side == "BUY":
                    # リスク再チェック（資産は約定前の概算）
                    equity_now = cash + _mark_to_market(positions, price_data, dt, prefer="Open")
                    pos_val = positions.get(t, {}).get("shares", 0) * open_price
                    shares, risk_reason = clamp_buy_shares(
                        equity=equity_now,
                        price=fill_price,
                        requested_shares=shares,
                        current_position_value=pos_val,
                        cash=cash,
                    )
                    if shares <= 0:
                        logger.info("買いスキップ %s: %s", t, risk_reason)
                        continue
                    cost = fill_price * shares
                    fee = apply_commission(cost)
                    total = cost + fee
                    if total > cash:
                        shares = int(cash // (fill_price * (1 + COMMISSION_RATE)))
                        if shares <= 0:
                            continue
                        cost = fill_price * shares
                        fee = apply_commission(cost)
                        total = cost + fee
                    cash -= total
                    prev = positions.get(t, {"shares": 0, "avg_price": 0.0})
                    new_shares = int(prev["shares"]) + shares
                    # 平均取得単価を更新
                    if new_shares > 0:
                        avg = (
                            prev["avg_price"] * prev["shares"] + fill_price * shares
                        ) / new_shares
                    else:
                        avg = 0.0
                    positions[t] = {"shares": new_shares, "avg_price": avg}
                    equity_now = cash + _mark_to_market(positions, price_data, dt, prefer="Open")
                    trades.append(
                        TradeRecord(
                            date=dt.strftime("%Y-%m-%d"),
                            ticker=t,
                            side="BUY",
                            price=fill_price,
                            shares=shares,
                            reason=f"{reason} / {risk_reason}",
                            equity=equity_now,
                        )
                    )
                else:  # SELL
                    held = int(positions.get(t, {}).get("shares", 0))
                    shares = min(shares, held)
                    if shares <= 0:
                        continue
                    proceeds = fill_price * shares
                    fee = apply_commission(proceeds)
                    cash += proceeds - fee
                    avg = float(positions[t]["avg_price"])
                    pnl = (fill_price - avg) * shares - fee
                    left = held - shares
                    if left <= 0:
                        positions.pop(t, None)
                    else:
                        positions[t]["shares"] = left
                    equity_now = cash + _mark_to_market(positions, price_data, dt, prefer="Open")
                    trades.append(
                        TradeRecord(
                            date=dt.strftime("%Y-%m-%d"),
                            ticker=t,
                            side="SELL",
                            price=fill_price,
                            shares=shares,
                            reason=reason,
                            equity=equity_now,
                            pnl=pnl,
                        )
                    )
            except Exception as e:
                log_exception(logger, f"約定処理失敗 {t} {dt.date()}", e)

        pending = still_pending

        # ---- 2) 当日終値で資産評価・停止判定 ----
        equity = cash + _mark_to_market(positions, price_data, dt, prefer="Close")
        if dt >= bt_start:
            equity_points.append((dt, equity))

        stop = check_portfolio_stop(equity, initial_cash=initial_cash)
        if stop.should_stop and not stopped:
            stopped = True
            stop_reason = stop.reason
            # 全ポジションを当日終値ベースで翌日始値決済予約
            for t, pos in list(positions.items()):
                pending.append(
                    {
                        "ticker": t,
                        "side": "SELL",
                        "shares": int(pos["shares"]),
                        "reason": stop_reason,
                        "signal_date": dt.strftime("%Y-%m-%d"),
                    }
                )
            # 新規シグナルはもう立てない
            continue

        if stopped:
            continue

        # ---- 3) 終値でシグナル判定 → 翌営業日約定の予約 ----
        if dt < bt_start:
            # ウォームアップ期間はシグナルを貯めない（MA計算自体は signals 側で済んでいる）
            continue

        for t in tickers:
            try:
                if dt not in signals[t].index:
                    continue
                sig = int(signals[t].loc[dt])
                if sig == 0:
                    continue

                row = price_data[t].loc[dt]
                # 判断理由はシグナル種別ベース（詳細MA値は paper_trade 側で付与）
                reason = explain_signal(sig)

                if sig == 1:
                    # 空き枠いっぱい買う（上限比率ベース）
                    equity_now = equity
                    pos_val = float(positions.get(t, {}).get("shares", 0)) * float(row["Close"])
                    # 翌営業日始値は未知なので、終値を仮置きして数量を決める
                    est_price = apply_slippage(float(row["Close"]), "BUY")
                    # 要求数量は「上限いっぱい」
                    req = max_shares_for_ticker(
                        equity=equity_now,
                        price=est_price,
                        current_position_value=pos_val,
                        max_ratio=MAX_POSITION_RATIO,
                    )
                    if req <= 0:
                        continue
                    pending.append(
                        {
                            "ticker": t,
                            "side": "BUY",
                            "shares": req,
                            "reason": reason,
                            "signal_date": dt.strftime("%Y-%m-%d"),
                        }
                    )
                elif sig == -1:
                    held = int(positions.get(t, {}).get("shares", 0))
                    if held <= 0:
                        continue
                    pending.append(
                        {
                            "ticker": t,
                            "side": "SELL",
                            "shares": held,
                            "reason": reason,
                            "signal_date": dt.strftime("%Y-%m-%d"),
                        }
                    )
            except Exception as e:
                log_exception(logger, f"シグナル予約失敗 {t} {dt.date()}", e)

    # 停止後に残った売り予約を最終日まで消化できなかった場合はそのまま
    equity_curve = pd.Series(
        {d: v for d, v in equity_points},
        dtype=float,
        name="strategy_equity",
    ).sort_index()

    # ベンチマーク: バックテスト開始時点の終値でフル投資した想定
    bench_curve = _benchmark_buy_and_hold(bench, equity_curve.index, initial_cash)

    total_return = (
        float(equity_curve.iloc[-1] / initial_cash - 1.0) if len(equity_curve) else 0.0
    )
    max_dd = _calc_max_drawdown(equity_curve)
    sharpe = _calc_sharpe(equity_curve)
    win_rate = _calc_win_rate(trades)
    trade_count = len(trades)

    chart_path = None
    if save_chart and not equity_curve.empty:
        chart_path = save_comparison_chart(equity_curve, bench_curve)

    result = BacktestResult(
        equity_curve=equity_curve,
        benchmark_curve=bench_curve,
        trades=trades,
        total_return=total_return,
        max_drawdown=max_dd,
        sharpe_ratio=sharpe,
        win_rate=win_rate,
        trade_count=trade_count,
        stopped=stopped,
        stop_reason=stop_reason,
        chart_path=chart_path,
    )
    return result


def _mark_to_market(
    positions: dict[str, dict[str, float]],
    price_data: dict[str, pd.DataFrame],
    dt: pd.Timestamp,
    prefer: str = "Close",
) -> float:
    """保有株の時価合計。"""
    total = 0.0
    for t, pos in positions.items():
        shares = float(pos.get("shares", 0))
        if shares <= 0:
            continue
        df = price_data.get(t)
        if df is None or dt not in df.index:
            continue
        px = float(df.loc[dt, prefer if prefer in df.columns else "Close"])
        total += shares * px
    return total


def _benchmark_buy_and_hold(
    bench: pd.DataFrame,
    index: pd.DatetimeIndex,
    initial_cash: float,
) -> pd.Series:
    """1306.T を期間開始で買って持ち続ける資産曲線。"""
    if bench.empty or index.empty:
        return pd.Series(dtype=float, name="benchmark_equity")

    common = bench.index.intersection(index)
    if common.empty:
        return pd.Series(dtype=float, name="benchmark_equity")

    start_px = float(bench.loc[common[0], "Close"])
    # 手数料・スリッページを最初の購入にだけ簡易反映
    buy_px = apply_slippage(start_px, "BUY")
    fee = apply_commission(initial_cash)
    investable = initial_cash - fee
    shares = investable / buy_px if buy_px > 0 else 0.0

    curve = bench.loc[common, "Close"].astype(float) * shares
    curve.name = "benchmark_equity"
    return curve


def save_comparison_chart(
    equity_curve: pd.Series,
    benchmark_curve: pd.Series,
    path: Path | None = None,
) -> Path:
    """戦略 vs ベンチマークの資産推移グラフを保存。"""
    ensure_dir(OUTPUT_DIR)
    if path is None:
        path = OUTPUT_DIR / "backtest_vs_1306.png"

    fig, ax = plt.subplots(figsize=(10, 5))
    # 初期資金=1 に正規化して見やすくする
    if not equity_curve.empty:
        ax.plot(
            equity_curve.index,
            equity_curve / float(equity_curve.iloc[0]),
            label="Strategy",
            linewidth=2,
        )
    if not benchmark_curve.empty:
        ax.plot(
            benchmark_curve.index,
            benchmark_curve / float(benchmark_curve.iloc[0]),
            label=f"{BENCHMARK_TICKER} Buy&Hold",
            linewidth=2,
            alpha=0.85,
        )
    ax.set_title("Paper Strategy vs TOPIX ETF (1306.T)")
    ax.set_ylabel("Growth of 1.0")
    ax.grid(True, alpha=0.3)
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(path, dpi=140)
    plt.close(fig)
    logger.info("比較グラフを保存: %s", path)
    return path


def print_summary(result: BacktestResult) -> None:
    """成績サマリーを画面表示。"""
    print("\n========== バックテスト結果 ==========")
    print(f"総リターン        : {result.total_return:.2%}")
    print(f"最大ドローダウン  : {result.max_drawdown:.2%}")
    print(f"シャープレシオ    : {result.sharpe_ratio:.3f}")
    print(f"勝率（売り損益）  : {result.win_rate:.2%}")
    print(f"取引回数          : {result.trade_count}")
    if not result.benchmark_curve.empty and not result.equity_curve.empty:
        bench_ret = float(result.benchmark_curve.iloc[-1] / result.benchmark_curve.iloc[0] - 1.0)
        print(f"1306.T B&H リターン: {bench_ret:.2%}")
    if result.stopped:
        print(f"停止              : YES ({result.stop_reason})")
    if result.chart_path:
        print(f"グラフ            : {result.chart_path}")
    print("====================================\n")


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== backtest.py 動作確認 ===")
    try:
        result = run_backtest()
        print_summary(result)
        if result.trades:
            print("直近の取引5件:")
            for t in result.trades[-5:]:
                print(
                    f"  {t.date} {t.side:4s} {t.ticker} {t.shares}株 @ {t.price:.2f} "
                    f"equity={t.equity:,.0f}"
                )
    except Exception as e:
        log_exception(logger, "backtest.py 実行失敗", e)
        print("失敗しました。logs/app.log を確認してください。")
