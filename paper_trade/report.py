"""
report.py
---------
現在の資産推移と 1306.T 比較グラフ、成績サマリーを表示する。

見るもの:
- trades.db に溜まった仮想売買と資産履歴
- ベンチマーク（TOPIX連動ETF 1306.T）との成長比較
- 総リターン・最大DD・勝率・取引回数など

動作確認:
    cd paper_trade
    python3 report.py
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from backtest import apply_commission, apply_slippage, save_comparison_chart
from config import INITIAL_CASH, OUTPUT_DIR
from data import get_benchmark_history
from db import get_all_positions, get_cash, init_db, is_stopped, list_equity_history, list_trades
from logging_utils import ensure_dir, get_logger, log_exception

logger = get_logger(__name__)


def _trades_to_frame(trades: list[dict]) -> pd.DataFrame:
    if not trades:
        return pd.DataFrame(
            columns=["traded_at", "ticker", "side", "price", "shares", "reason", "equity"]
        )
    df = pd.DataFrame(trades)
    df["traded_at"] = pd.to_datetime(df["traded_at"])
    return df.sort_values("traded_at")


def _equity_history_frame(rows: list[dict]) -> pd.Series:
    if not rows:
        return pd.Series(dtype=float, name="equity")
    df = pd.DataFrame(rows)
    df["as_of"] = pd.to_datetime(df["as_of"])
    s = df.set_index("as_of")["equity"].astype(float).sort_index()
    s.name = "equity"
    return s


def _estimate_sell_pnls(trades: pd.DataFrame) -> list[float]:
    """
    簡易的に銘柄ごとの平均取得単価から売り損益を復元し、勝率計算に使う。
    """
    avg: dict[str, tuple[int, float]] = {}
    pnls: list[float] = []
    for _, row in trades.iterrows():
        t = row["ticker"]
        shares = int(row["shares"])
        price = float(row["price"])
        if row["side"] == "BUY":
            prev_shares, prev_avg = avg.get(t, (0, 0.0))
            new_shares = prev_shares + shares
            new_avg = (
                (prev_avg * prev_shares + price * shares) / new_shares if new_shares else 0.0
            )
            avg[t] = (new_shares, new_avg)
        elif row["side"] == "SELL":
            prev_shares, prev_avg = avg.get(t, (0, 0.0))
            sell_shares = min(shares, prev_shares) if prev_shares else shares
            fee = apply_commission(price * sell_shares)
            pnl = (price - prev_avg) * sell_shares - fee
            pnls.append(pnl)
            left = max(prev_shares - sell_shares, 0)
            avg[t] = (left, prev_avg if left else 0.0)
    return pnls


def _max_drawdown(equity: pd.Series) -> float:
    if equity.empty:
        return 0.0
    peak = equity.cummax()
    return float((equity / peak - 1.0).min())


def _benchmark_curve_for(index: pd.DatetimeIndex) -> pd.Series:
    """レポート期間に合わせた 1306.T バイ＆ホールド曲線。"""
    if index.empty:
        return pd.Series(dtype=float, name="benchmark_equity")

    start = (index.min() - pd.Timedelta(days=10)).strftime("%Y-%m-%d")
    end = (index.max() + pd.Timedelta(days=2)).strftime("%Y-%m-%d")
    bench = get_benchmark_history(start=start, end=end)
    if bench.empty:
        return pd.Series(dtype=float, name="benchmark_equity")

    common = bench.index.intersection(index)
    if common.empty:
        # 資産履歴が1日だけなどのとき、ベンチも同じ日で点を返す
        common = bench.index[bench.index <= index.max()]
        if common.empty:
            return pd.Series(dtype=float, name="benchmark_equity")
        common = common[-1:]

    start_px = float(bench.loc[common[0], "Close"])
    buy_px = apply_slippage(start_px, "BUY")
    fee = apply_commission(INITIAL_CASH)
    shares = (INITIAL_CASH - fee) / buy_px if buy_px > 0 else 0.0
    curve = bench.loc[common, "Close"].astype(float) * shares
    curve.name = "benchmark_equity"
    return curve


def build_summary() -> dict:
    """成績サマリー辞書を作る。"""
    init_db()
    trades = _trades_to_frame(list_trades())
    equity = _equity_history_frame(list_equity_history())
    cash = get_cash()
    positions = get_all_positions()

    if equity.empty:
        # 取引だけある場合は trades.equity から代用
        if not trades.empty:
            equity = trades.set_index("traded_at")["equity"].astype(float)
            equity.name = "equity"
        else:
            equity = pd.Series([INITIAL_CASH], index=[pd.Timestamp.now().normalize()], name="equity")

    total_return = float(equity.iloc[-1] / INITIAL_CASH - 1.0)
    max_dd = _max_drawdown(equity)
    pnls = _estimate_sell_pnls(trades) if not trades.empty else []
    win_rate = (sum(1 for p in pnls if p > 0) / len(pnls)) if pnls else 0.0

    bench = _benchmark_curve_for(equity.index)
    bench_return = None
    if not bench.empty:
        bench_return = float(bench.iloc[-1] / bench.iloc[0] - 1.0)

    return {
        "cash": cash,
        "equity": float(equity.iloc[-1]),
        "positions": positions,
        "total_return": total_return,
        "max_drawdown": max_dd,
        "win_rate": win_rate,
        "trade_count": int(len(trades)),
        "stopped": is_stopped(),
        "equity_curve": equity,
        "benchmark_curve": bench,
        "benchmark_return": bench_return,
        "trades": trades,
    }


def save_report_chart(equity: pd.Series, benchmark: pd.Series) -> Path:
    ensure_dir(OUTPUT_DIR)
    path = OUTPUT_DIR / "paper_vs_1306.png"
    return save_comparison_chart(equity, benchmark, path=path)


def print_report() -> Path | None:
    """サマリーを表示し、グラフを保存する。"""
    summary = build_summary()
    print("\n========== ペーパートレード成績 ==========")
    print(f"現在の現金        : {summary['cash']:,.0f} 円")
    print(f"現在の資産総額    : {summary['equity']:,.0f} 円")
    print(f"総リターン        : {summary['total_return']:.2%}")
    print(f"最大ドローダウン  : {summary['max_drawdown']:.2%}")
    print(f"勝率（売り損益）  : {summary['win_rate']:.2%}")
    print(f"取引回数          : {summary['trade_count']}")
    if summary["benchmark_return"] is not None:
        print(f"1306.T リターン   : {summary['benchmark_return']:.2%}")
    print(f"停止中            : {'YES' if summary['stopped'] else 'NO'}")
    print("保有ポジション:")
    if summary["positions"]:
        for p in summary["positions"]:
            print(f"  {p['ticker']}: {p['shares']} 株 (平均取得 {p['avg_price']:.2f})")
    else:
        print("  （なし）")

    chart_path = None
    try:
        if not summary["equity_curve"].empty:
            chart_path = save_report_chart(
                summary["equity_curve"],
                summary["benchmark_curve"],
            )
            print(f"グラフ            : {chart_path}")
    except Exception as e:
        log_exception(logger, "レポートグラフ保存失敗", e)

    # 直近取引
    trades = summary["trades"]
    if not trades.empty:
        print("\n直近の取引:")
        for _, row in trades.tail(5).iterrows():
            print(
                f"  {row['traded_at'].date()} {row['side']:4s} {row['ticker']} "
                f"{int(row['shares'])}株 @ {float(row['price']):.2f} "
                f"| {row['reason']}"
            )
    print("========================================\n")
    return chart_path


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== report.py 動作確認 ===")
    try:
        print_report()
    except Exception as e:
        log_exception(logger, "report.py 実行失敗", e)
        print("失敗しました。logs/app.log を確認してください。")
