"""
data.py
-------
yfinance で日本株の日次株価（OHLCV）を取得し、ローカルにキャッシュする。

ポイント:
- 一度取ったデータは cache/ に CSV 保存し、同じ期間なら再取得を減らす
- 失敗してもアプリ全体は止めず、ログに残す
- 未来のデータは使わない（取得できるのは「すでに確定した日次データ」のみ）

動作確認:
    cd paper_trade
    python data.py
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

import pandas as pd
import yfinance as yf

from config import BENCHMARK_TICKER, CACHE_DIR, TICKERS
from logging_utils import ensure_dir, get_logger, log_exception

logger = get_logger(__name__)


def _cache_path(ticker: str) -> Path:
    """銘柄ごとのキャッシュファイルパスを返す。"""
    # ファイル名に使えない文字を避けるため、ドットをアンダースコアに置換
    safe_name = ticker.replace(".", "_")
    return ensure_dir(CACHE_DIR) / f"{safe_name}.csv"


def _normalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """
    yfinance の戻り値を、このアプリで使いやすい形に整える。

    - 列名を Open/High/Low/Close/Volume にそろえる
    - 日付インデックス名を Date にする
    - 欠損行を落とす
    """
    if df is None or df.empty:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    # MultiIndex 列になることがあるので、1段に落とす
    if isinstance(df.columns, pd.MultiIndex):
        df = df.copy()
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]

    # 必要な列だけ残す（無い列は後でエラーになるので先にチェック）
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"必要な列がありません: {missing}")

    out = df[required].copy()
    out.index = pd.to_datetime(out.index)
    out.index.name = "Date"
    # 数値に変換できない値は欠損にする
    out = out.apply(pd.to_numeric, errors="coerce")
    out = out.dropna(subset=["Open", "High", "Low", "Close"])
    out = out.sort_index()
    return out


def _download_from_yfinance(ticker: str, start: str, end: str | None = None) -> pd.DataFrame:
    """
    yfinance から日次株価をダウンロードする。

    Parameters
    ----------
    ticker : 銘柄コード（例: "7203.T"）
    start  : 開始日 "YYYY-MM-DD"
    end    : 終了日 "YYYY-MM-DD"（省略時は今日まで）
    """
    # auto_adjust=False で配当調整前の生に近い価格を使う
    # （戦略比較の一貫性のため。必要なら後で変更可）
    raw = yf.download(
        ticker,
        start=start,
        end=end,
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    return _normalize_ohlcv(raw)


def _read_cache(ticker: str) -> pd.DataFrame:
    """キャッシュCSVを読む。無ければ空の DataFrame。"""
    path = _cache_path(ticker)
    if not path.exists():
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    try:
        df = pd.read_csv(path, index_col="Date", parse_dates=True)
        return _normalize_ohlcv(df)
    except Exception as e:
        log_exception(logger, f"キャッシュ読み込み失敗 ({ticker})", e)
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])


def _write_cache(ticker: str, df: pd.DataFrame) -> None:
    """キャッシュCSVに書き出す。"""
    try:
        path = _cache_path(ticker)
        df.to_csv(path)
        logger.info("キャッシュ保存: %s (%d行) -> %s", ticker, len(df), path)
    except Exception as e:
        log_exception(logger, f"キャッシュ保存失敗 ({ticker})", e)


def get_price_history(
    ticker: str,
    start: str | None = None,
    end: str | None = None,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    1銘柄の日次株価を返す（キャッシュ優先）。

    Parameters
    ----------
    ticker : 銘柄コード
    start  : 開始日。省略時は約4年前（移動平均のウォームアップ余裕付き）
    end    : 終了日。省略時は今日
    use_cache : True ならキャッシュを使う
    force_refresh : True ならキャッシュを無視して再取得

    Returns
    -------
    DataFrame（index=Date, columns=Open/High/Low/Close/Volume）
    失敗時は空の DataFrame
    """
    if start is None:
        start = (datetime.now() - timedelta(days=365 * 4 + 30)).strftime("%Y-%m-%d")
    if end is None:
        # yfinance の end は「含まない」日なので、明日を指定して今日まで取る
        end = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    cached = pd.DataFrame()
    if use_cache and not force_refresh:
        cached = _read_cache(ticker)

    need_download = True
    if not cached.empty:
        # キャッシュが開始日以前からあり、終了日近くまであれば再利用
        cache_start = cached.index.min().strftime("%Y-%m-%d")
        cache_end = cached.index.max().strftime("%Y-%m-%d")
        # end は「翌日」指定なので、最終営業日が end の前日以降なら十分とみなす
        end_check = (pd.Timestamp(end) - pd.Timedelta(days=3)).strftime("%Y-%m-%d")
        if cache_start <= start and cache_end >= end_check:
            need_download = False
            logger.info("キャッシュ利用: %s (%s 〜 %s)", ticker, cache_start, cache_end)

    if need_download or force_refresh:
        try:
            logger.info("ダウンロード開始: %s (%s 〜 %s)", ticker, start, end)
            downloaded = _download_from_yfinance(ticker, start=start, end=end)
            if downloaded.empty:
                logger.warning("データが空でした: %s", ticker)
                # 既存キャッシュがあればそれを期間で切って返す
                if not cached.empty:
                    return cached.loc[start : (pd.Timestamp(end) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")]
                return downloaded

            # 古いキャッシュと結合して最新化
            if not cached.empty:
                merged = pd.concat([cached, downloaded])
                merged = merged[~merged.index.duplicated(keep="last")].sort_index()
            else:
                merged = downloaded

            if use_cache:
                _write_cache(ticker, merged)
            cached = merged
        except Exception as e:
            log_exception(logger, f"ダウンロード失敗 ({ticker})", e)
            if cached.empty:
                return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])

    # 要求期間で切り出す
    end_inclusive = (pd.Timestamp(end) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    result = cached.loc[start:end_inclusive].copy()
    return result


def get_many_price_histories(
    tickers: Iterable[str] | None = None,
    start: str | None = None,
    end: str | None = None,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> dict[str, pd.DataFrame]:
    """
    複数銘柄の株価をまとめて取得する。

    1銘柄で失敗しても他の銘柄は続行する。
    """
    if tickers is None:
        tickers = list(TICKERS)

    result: dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        try:
            result[ticker] = get_price_history(
                ticker,
                start=start,
                end=end,
                use_cache=use_cache,
                force_refresh=force_refresh,
            )
        except Exception as e:
            log_exception(logger, f"銘柄取得ループで失敗 ({ticker})", e)
            result[ticker] = pd.DataFrame(columns=["Open", "High", "Low", "Close", "Volume"])
    return result


def get_benchmark_history(
    start: str | None = None,
    end: str | None = None,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """ベンチマーク（1306.T）の日次株価を返す。"""
    return get_price_history(
        BENCHMARK_TICKER,
        start=start,
        end=end,
        use_cache=use_cache,
        force_refresh=force_refresh,
    )


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== data.py 動作確認 ===")
    print(f"対象銘柄: {TICKERS}")
    print(f"ベンチマーク: {BENCHMARK_TICKER}")

    # まず1銘柄だけ丁寧に確認
    sample = TICKERS[0]
    df = get_price_history(sample)
    print(f"\n[{sample}] 行数={len(df)}")
    if not df.empty:
        print(df.tail(3))
        print(f"キャッシュファイル: {_cache_path(sample)}")
    else:
        print("データ取得に失敗しました。logs/app.log を確認してください。")

    # ついでに全銘柄 + ベンチマークも取得してみる
    print("\n全銘柄を取得中...")
    all_data = get_many_price_histories()
    for t, frame in all_data.items():
        print(f"  {t}: {len(frame)} 行")

    bench = get_benchmark_history()
    print(f"  {BENCHMARK_TICKER}: {len(bench)} 行")
    print("\n完了。cache/ に CSV があれば成功です。")
