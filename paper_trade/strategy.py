"""
strategy.py
-----------
売買シグナルを返すモジュール。

設計方針:
- 「価格データ → シグナル列」という共通の形にする
- 最初の戦略は移動平均クロス（25日線が75日線を上抜けたら買い、下抜けたら売り）
- 後で別戦略に差し替えるときは、同じ戻り値の形を守った関数を追加し、
  get_strategy() の中身を切り替えるだけでよい

シグナルの意味:
-  1 : 買い（新規ロング or 保有継続のトリガー）
- -1 : 売り（手仕舞い）
-  0 : 何もしない

重要:
- シグナルはその日の終値（と、その時点まで分かる移動平均）だけで判定する
- 未来のデータは使わない
- 実際の約定は「翌営業日の始値」側（backtest / paper_trade）で行う

動作確認:
    cd paper_trade
    python3 strategy.py
"""

from __future__ import annotations

from typing import Callable

import pandas as pd

from config import LONG_MA_DAYS, SHORT_MA_DAYS, TICKERS
from data import get_price_history
from logging_utils import get_logger, log_exception

logger = get_logger(__name__)

# 戦略関数の型: DataFrame を受け取り、同じ日付インデックスのシグナル Series を返す
StrategyFunc = Callable[[pd.DataFrame], pd.Series]


def ma_crossover_signals(
    df: pd.DataFrame,
    short_window: int = SHORT_MA_DAYS,
    long_window: int = LONG_MA_DAYS,
) -> pd.Series:
    """
    移動平均クロス戦略のシグナルを返す。

    - 短期MAが長期MAを下から上へ抜けたら（ゴールデンクロス）買い = 1
    - 短期MAが長期MAを上から下へ抜けたら（デッドクロス）売り = -1
    - それ以外は 0

    Parameters
    ----------
    df : Open/High/Low/Close/Volume を持つ日次データ
    short_window : 短期移動平均の日数
    long_window  : 長期移動平均の日数
    """
    if df is None or df.empty or "Close" not in df.columns:
        return pd.Series(dtype=int, name="signal")

    close = df["Close"].astype(float)

    # 終値の単純移動平均（その日までのデータだけで計算 = 未来参照なし）
    short_ma = close.rolling(window=short_window, min_periods=short_window).mean()
    long_ma = close.rolling(window=long_window, min_periods=long_window).mean()

    # 前日時点で短期が長期より下/上だったか
    prev_short_below = short_ma.shift(1) <= long_ma.shift(1)
    prev_short_above = short_ma.shift(1) >= long_ma.shift(1)

    # 当日、短期が長期を上回った / 下回ったか
    cross_up = prev_short_below & (short_ma > long_ma)
    cross_down = prev_short_above & (short_ma < long_ma)

    signal = pd.Series(0, index=df.index, dtype=int, name="signal")
    signal = signal.mask(cross_up, 1)
    signal = signal.mask(cross_down, -1)

    # 移動平均がまだ計算できない初期期間は 0 のまま
    signal = signal.fillna(0).astype(int)
    return signal


def build_signal_frame(
    df: pd.DataFrame,
    strategy: StrategyFunc | None = None,
) -> pd.DataFrame:
    """
    価格データにシグナルと移動平均を付けた DataFrame を返す（確認・デバッグ用）。
    """
    if strategy is None:
        strategy = get_strategy()

    out = df.copy()
    out["short_ma"] = out["Close"].rolling(SHORT_MA_DAYS, min_periods=SHORT_MA_DAYS).mean()
    out["long_ma"] = out["Close"].rolling(LONG_MA_DAYS, min_periods=LONG_MA_DAYS).mean()
    out["signal"] = strategy(df)
    return out


def explain_signal(signal_value: int, short_ma: float | None = None, long_ma: float | None = None) -> str:
    """
    シグナルの判断理由を日本語の短い文で返す（DB保存用）。
    """
    if signal_value == 1:
        base = f"{SHORT_MA_DAYS}日線が{LONG_MA_DAYS}日線を上抜け（ゴールデンクロス）"
    elif signal_value == -1:
        base = f"{SHORT_MA_DAYS}日線が{LONG_MA_DAYS}日線を下抜け（デッドクロス）"
    else:
        base = "クロスなし（様子見）"

    if short_ma is not None and long_ma is not None and pd.notna(short_ma) and pd.notna(long_ma):
        return f"{base} / 短期MA={short_ma:.2f}, 長期MA={long_ma:.2f}"
    return base


def get_strategy(name: str = "ma_crossover") -> StrategyFunc:
    """
    戦略名から関数を取り出す。

    新しい戦略を追加する手順:
    1. このファイルに「df -> signal Series」の関数を書く
    2. 下の辞書に名前を登録する
    3. get_strategy("新しい名前") またはデフォルト名を変える
    """
    strategies: dict[str, StrategyFunc] = {
        "ma_crossover": ma_crossover_signals,
        # 例: "rsi": rsi_signals,
    }
    if name not in strategies:
        logger.warning("未知の戦略名 '%s'。ma_crossover にフォールバックします。", name)
        return ma_crossover_signals
    return strategies[name]


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== strategy.py 動作確認 ===")
    ticker = TICKERS[0]
    try:
        df = get_price_history(ticker)
        framed = build_signal_frame(df)
        buys = (framed["signal"] == 1).sum()
        sells = (framed["signal"] == -1).sum()
        print(f"銘柄: {ticker}")
        print(f"買いシグナル回数: {buys}")
        print(f"売りシグナル回数: {sells}")
        print("\n直近のシグナル発生日:")
        events = framed[framed["signal"] != 0][["Close", "short_ma", "long_ma", "signal"]].tail(5)
        print(events if not events.empty else "（期間内にクロスなし）")
    except Exception as e:
        log_exception(logger, "strategy.py 動作確認で失敗", e)
        print("失敗しました。logs/app.log を確認してください。")
