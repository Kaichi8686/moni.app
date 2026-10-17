"""
paper_trade.py
--------------
毎日実行する仮想売買（ペーパートレード）。

流れ:
1. 最新の株価を取得（キャッシュ更新）
2. PENDING の予約注文があれば、シグナル日の翌営業日以降の始値で約定してDBへ記録
3. 最新の確定終値でシグナル判定し、翌営業日始値約定の予約をDBに残す
4. 資産総額を記録。全体損失が -15% なら全決済予約して停止

実際の証券会社APIやお金には接続しない。

動作確認:
    cd paper_trade
    python3 paper_trade.py
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from backtest import apply_commission, apply_slippage
from config import COMMISSION_RATE, INITIAL_CASH, MAX_POSITION_RATIO, TICKERS
from data import get_many_price_histories
from db import (
    add_pending_order,
    get_all_positions,
    get_cash,
    get_position,
    init_db,
    insert_trade,
    is_stopped,
    list_pending_orders,
    mark_pending_order,
    record_equity,
    set_cash,
    set_stopped,
    upsert_position,
)
from logging_utils import get_logger, log_exception
from risk import check_portfolio_stop, clamp_buy_shares, max_shares_for_ticker
from strategy import build_signal_frame, explain_signal, get_strategy

logger = get_logger(__name__)


def _latest_common_date(data: dict[str, pd.DataFrame]) -> pd.Timestamp | None:
    """取得できた銘柄の中で、いちばん新しい共通営業日を返す。"""
    dates = None
    for df in data.values():
        if df is None or df.empty:
            continue
        idx = set(df.index)
        dates = idx if dates is None else dates.intersection(idx)
    if not dates:
        return None
    return max(dates)


def _current_equity(cash: float, data: dict[str, pd.DataFrame], as_of: pd.Timestamp) -> float:
    """現金 + 保有株の時価。"""
    equity = cash
    for pos in get_all_positions():
        t = pos["ticker"]
        df = data.get(t)
        if df is None or as_of not in df.index:
            continue
        equity += float(pos["shares"]) * float(df.loc[as_of, "Close"])
    return equity


def _execute_pending_orders(data: dict[str, pd.DataFrame], as_of: pd.Timestamp) -> None:
    """
    予約注文を、シグナル日より後の営業日の始値で約定させる。
    """
    if is_stopped() and not list_pending_orders():
        return

    cash = get_cash()
    pending = list_pending_orders()

    for order in pending:
        try:
            t = order["ticker"]
            signal_date = pd.Timestamp(order["signal_date"])
            if as_of <= signal_date:
                # まだ翌営業日になっていない
                continue

            df = data.get(t)
            if df is None or as_of not in df.index:
                logger.warning("約定日のデータが無いため保留: %s %s", t, as_of.date())
                continue

            open_price = float(df.loc[as_of, "Open"])
            side = order["side"]
            shares = int(order["shares"])
            reason = order.get("reason") or ""

            if side == "BUY":
                if is_stopped():
                    mark_pending_order(order["id"], "CANCELLED")
                    continue

                fill_price = apply_slippage(open_price, "BUY")
                pos = get_position(t)
                equity = _current_equity(cash, data, as_of)
                pos_val = float(pos["shares"]) * open_price
                shares, risk_reason = clamp_buy_shares(
                    equity=equity,
                    price=fill_price,
                    requested_shares=shares,
                    current_position_value=pos_val,
                    cash=cash,
                )
                if shares <= 0:
                    mark_pending_order(order["id"], "CANCELLED")
                    logger.info("買いキャンセル %s: %s", t, risk_reason)
                    continue

                cost = fill_price * shares
                fee = apply_commission(cost)
                total = cost + fee
                if total > cash:
                    shares = int(cash // (fill_price * (1 + COMMISSION_RATE)))
                    if shares <= 0:
                        mark_pending_order(order["id"], "CANCELLED")
                        continue
                    cost = fill_price * shares
                    fee = apply_commission(cost)
                    total = cost + fee

                cash -= total
                new_shares = int(pos["shares"]) + shares
                if new_shares > 0:
                    avg = (pos["avg_price"] * pos["shares"] + fill_price * shares) / new_shares
                else:
                    avg = 0.0
                upsert_position(t, new_shares, avg)
                set_cash(cash)
                equity = _current_equity(cash, data, as_of)
                insert_trade(
                    traded_at=as_of.strftime("%Y-%m-%d"),
                    ticker=t,
                    side="BUY",
                    price=fill_price,
                    shares=shares,
                    reason=f"{reason} / {risk_reason}",
                    equity=equity,
                    signal_date=order["signal_date"],
                )
                mark_pending_order(order["id"], "FILLED")

            elif side == "SELL":
                fill_price = apply_slippage(open_price, "SELL")
                pos = get_position(t)
                held = int(pos["shares"])
                shares = min(shares, held)
                if shares <= 0:
                    mark_pending_order(order["id"], "CANCELLED")
                    continue
                proceeds = fill_price * shares
                fee = apply_commission(proceeds)
                cash += proceeds - fee
                left = held - shares
                upsert_position(t, left, pos["avg_price"] if left > 0 else 0.0)
                set_cash(cash)
                equity = _current_equity(cash, data, as_of)
                insert_trade(
                    traded_at=as_of.strftime("%Y-%m-%d"),
                    ticker=t,
                    side="SELL",
                    price=fill_price,
                    shares=shares,
                    reason=reason,
                    equity=equity,
                    signal_date=order["signal_date"],
                )
                mark_pending_order(order["id"], "FILLED")
        except Exception as e:
            log_exception(logger, f"予約約定失敗 id={order.get('id')}", e)


def _place_signals_for_latest_close(data: dict[str, pd.DataFrame], as_of: pd.Timestamp) -> None:
    """最新終値でシグナルを判定し、翌営業日始値用の予約を入れる。"""
    if is_stopped():
        logger.info("停止中のため新規シグナルは出しません")
        return

    strategy = get_strategy()
    cash = get_cash()
    equity = _current_equity(cash, data, as_of)

    # 停止ライン確認
    stop = check_portfolio_stop(equity)
    if stop.should_stop:
        set_stopped(True, stop.reason)
        # 全ポジションを翌始値で決済予約
        for pos in get_all_positions():
            add_pending_order(
                ticker=pos["ticker"],
                side="SELL",
                shares=int(pos["shares"]),
                reason=stop.reason,
                signal_date=as_of.strftime("%Y-%m-%d"),
            )
        record_equity(as_of.strftime("%Y-%m-%d"), cash, equity, note="STOPPED")
        return

    for t in TICKERS:
        try:
            df = data.get(t)
            if df is None or df.empty or as_of not in df.index:
                continue

            sig_series = strategy(df)
            sig = int(sig_series.loc[as_of]) if as_of in sig_series.index else 0
            framed = build_signal_frame(df)
            short_ma = float(framed.loc[as_of, "short_ma"]) if as_of in framed.index else None
            long_ma = float(framed.loc[as_of, "long_ma"]) if as_of in framed.index else None
            reason = explain_signal(sig, short_ma, long_ma)

            if sig == 1:
                pos = get_position(t)
                close_px = float(df.loc[as_of, "Close"])
                est = apply_slippage(close_px, "BUY")
                pos_val = float(pos["shares"]) * close_px
                req = max_shares_for_ticker(
                    equity=equity,
                    price=est,
                    current_position_value=pos_val,
                    max_ratio=MAX_POSITION_RATIO,
                )
                if req <= 0:
                    logger.info("%s: 買いシグナルだが上限到達のため予約なし", t)
                    continue
                add_pending_order(
                    ticker=t,
                    side="BUY",
                    shares=req,
                    reason=reason,
                    signal_date=as_of.strftime("%Y-%m-%d"),
                )
            elif sig == -1:
                pos = get_position(t)
                if int(pos["shares"]) <= 0:
                    continue
                add_pending_order(
                    ticker=t,
                    side="SELL",
                    shares=int(pos["shares"]),
                    reason=reason,
                    signal_date=as_of.strftime("%Y-%m-%d"),
                )
            else:
                logger.info("%s: %s", t, reason)
        except Exception as e:
            log_exception(logger, f"シグナル処理失敗 ({t})", e)


def run_paper_trade(force_refresh: bool = True) -> None:
    """1日分のペーパートレード処理を実行する。"""
    init_db()
    logger.info("ペーパートレード開始")

    try:
        data = get_many_price_histories(TICKERS, force_refresh=force_refresh)
    except Exception as e:
        log_exception(logger, "株価取得に失敗", e)
        return

    as_of = _latest_common_date(data)
    if as_of is None:
        logger.error("有効な株価日付がありません")
        return

    logger.info("基準日（最新終値）: %s", as_of.date())

    # 1) 予約の約定
    _execute_pending_orders(data, as_of)

    # 2) 新しいシグナル予約
    _place_signals_for_latest_close(data, as_of)

    # 3) 資産スナップショット
    cash = get_cash()
    equity = _current_equity(cash, data, as_of)
    record_equity(as_of.strftime("%Y-%m-%d"), cash, equity)
    logger.info(
        "記録完了: cash=%s equity=%s stopped=%s",
        f"{cash:,.0f}",
        f"{equity:,.0f}",
        is_stopped(),
    )


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== paper_trade.py 動作確認 ===")
    print(f"初期資金設定: {INITIAL_CASH:,.0f} 円")
    print(f"実行時刻: {datetime.now().isoformat(timespec='seconds')}")
    try:
        # 初回はキャッシュ更新ありで実行
        run_paper_trade(force_refresh=False)
        print(f"現金: {get_cash():,.0f}")
        print(f"ポジション: {get_all_positions()}")
        print(f"予約注文: {list_pending_orders()}")
        print(f"停止中?: {is_stopped()}")
        print("完了。trades.db を確認してください。")
    except Exception as e:
        log_exception(logger, "paper_trade.py 実行失敗", e)
        print("失敗しました。logs/app.log を確認してください。")
