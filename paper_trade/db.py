"""
db.py
-----
SQLite（trades.db）の初期化と読み書き。

保存する主なもの:
- trades : 仮想売買の履歴（日時、銘柄、売買、価格、数量、判断理由、資産総額）
- positions : いまの保有数量
- pending_orders : 「終値で判定 → 翌営業日始値で約定」のための予約注文
- meta : 停止フラグなど小さな状態

動作確認:
    cd paper_trade
    python3 db.py
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from config import DB_PATH, INITIAL_CASH
from logging_utils import get_logger, log_exception

logger = get_logger(__name__)


def _connect(db_path: Path | None = None) -> sqlite3.Connection:
    """SQLite 接続を作る。行を dict 風に取れるようにする。"""
    path = Path(db_path or DB_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    # 外部キーを有効化（将来の拡張用）
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_connection(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    """with 文で使える接続。例外時も閉じる。"""
    conn = _connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Path | None = None) -> None:
    """テーブルが無ければ作成する。何度呼んでも安全。"""
    try:
        with get_connection(db_path) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS trades (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    traded_at TEXT NOT NULL,
                    ticker TEXT NOT NULL,
                    side TEXT NOT NULL,          -- 'BUY' or 'SELL'
                    price REAL NOT NULL,
                    shares INTEGER NOT NULL,
                    reason TEXT,
                    equity REAL NOT NULL,         -- その時点の資産総額
                    signal_date TEXT,             -- シグナル判定日（終値の日）
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS positions (
                    ticker TEXT PRIMARY KEY,
                    shares INTEGER NOT NULL DEFAULT 0,
                    avg_price REAL NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS pending_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    side TEXT NOT NULL,          -- 'BUY' or 'SELL'
                    shares INTEGER NOT NULL,
                    reason TEXT,
                    signal_date TEXT NOT NULL,   -- 終値で判定した日
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING'  -- PENDING / FILLED / CANCELLED
                );

                CREATE TABLE IF NOT EXISTS equity_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    as_of TEXT NOT NULL UNIQUE,  -- 記録日
                    cash REAL NOT NULL,
                    equity REAL NOT NULL,
                    note TEXT
                );

                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """
            )

            # 初期現金・停止フラグを入れておく（無ければ）
            _set_meta_if_absent(conn, "cash", str(float(INITIAL_CASH)))
            _set_meta_if_absent(conn, "stopped", "0")
            _set_meta_if_absent(conn, "stop_reason", "")
            logger.info("DB初期化完了: %s", db_path or DB_PATH)
    except Exception as e:
        log_exception(logger, "DB初期化に失敗", e)


def _set_meta_if_absent(conn: sqlite3.Connection, key: str, value: str) -> None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO meta(key, value) VALUES (?, ?)",
            (key, value),
        )


def get_meta(key: str, default: str = "", db_path: Path | None = None) -> str:
    try:
        with get_connection(db_path) as conn:
            row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else default
    except Exception as e:
        log_exception(logger, f"meta取得失敗 ({key})", e)
        return default


def set_meta(key: str, value: str, db_path: Path | None = None) -> None:
    try:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT INTO meta(key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )
    except Exception as e:
        log_exception(logger, f"meta保存失敗 ({key})", e)


def get_cash(db_path: Path | None = None) -> float:
    return float(get_meta("cash", str(float(INITIAL_CASH)), db_path=db_path))


def set_cash(cash: float, db_path: Path | None = None) -> None:
    set_meta("cash", str(float(cash)), db_path=db_path)


def is_stopped(db_path: Path | None = None) -> bool:
    return get_meta("stopped", "0", db_path=db_path) == "1"


def set_stopped(stopped: bool, reason: str = "", db_path: Path | None = None) -> None:
    set_meta("stopped", "1" if stopped else "0", db_path=db_path)
    set_meta("stop_reason", reason, db_path=db_path)


def get_position(ticker: str, db_path: Path | None = None) -> dict[str, Any]:
    """保有が無ければ shares=0 の dict を返す。"""
    try:
        with get_connection(db_path) as conn:
            row = conn.execute(
                "SELECT ticker, shares, avg_price FROM positions WHERE ticker = ?",
                (ticker,),
            ).fetchone()
            if row is None:
                return {"ticker": ticker, "shares": 0, "avg_price": 0.0}
            return {
                "ticker": row["ticker"],
                "shares": int(row["shares"]),
                "avg_price": float(row["avg_price"]),
            }
    except Exception as e:
        log_exception(logger, f"position取得失敗 ({ticker})", e)
        return {"ticker": ticker, "shares": 0, "avg_price": 0.0}


def get_all_positions(db_path: Path | None = None) -> list[dict[str, Any]]:
    try:
        with get_connection(db_path) as conn:
            rows = conn.execute(
                "SELECT ticker, shares, avg_price FROM positions WHERE shares > 0"
            ).fetchall()
            return [
                {
                    "ticker": r["ticker"],
                    "shares": int(r["shares"]),
                    "avg_price": float(r["avg_price"]),
                }
                for r in rows
            ]
    except Exception as e:
        log_exception(logger, "全position取得失敗", e)
        return []


def upsert_position(
    ticker: str,
    shares: int,
    avg_price: float,
    db_path: Path | None = None,
) -> None:
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with get_connection(db_path) as conn:
            if shares <= 0:
                conn.execute("DELETE FROM positions WHERE ticker = ?", (ticker,))
            else:
                conn.execute(
                    """
                    INSERT INTO positions(ticker, shares, avg_price, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(ticker) DO UPDATE SET
                        shares = excluded.shares,
                        avg_price = excluded.avg_price,
                        updated_at = excluded.updated_at
                    """,
                    (ticker, shares, avg_price, now),
                )
    except Exception as e:
        log_exception(logger, f"position更新失敗 ({ticker})", e)


def insert_trade(
    traded_at: str,
    ticker: str,
    side: str,
    price: float,
    shares: int,
    reason: str,
    equity: float,
    signal_date: str | None = None,
    db_path: Path | None = None,
) -> None:
    """仮想売買を1件記録する。"""
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT INTO trades(
                    traded_at, ticker, side, price, shares,
                    reason, equity, signal_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    traded_at,
                    ticker,
                    side,
                    float(price),
                    int(shares),
                    reason,
                    float(equity),
                    signal_date,
                    now,
                ),
            )
        logger.info(
            "取引記録: %s %s %s %d株 @ %.2f / equity=%.0f",
            traded_at,
            side,
            ticker,
            shares,
            price,
            equity,
        )
    except Exception as e:
        log_exception(logger, "取引記録失敗", e)


def list_trades(db_path: Path | None = None) -> list[dict[str, Any]]:
    try:
        with get_connection(db_path) as conn:
            rows = conn.execute(
                """
                SELECT traded_at, ticker, side, price, shares, reason, equity, signal_date
                FROM trades
                ORDER BY traded_at ASC, id ASC
                """
            ).fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        log_exception(logger, "取引一覧取得失敗", e)
        return []


def add_pending_order(
    ticker: str,
    side: str,
    shares: int,
    reason: str,
    signal_date: str,
    db_path: Path | None = None,
) -> None:
    """終値判定の結果を、翌営業日始値約定の予約として残す。"""
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with get_connection(db_path) as conn:
            # 同じ銘柄・同じシグナル日の PENDING が重複しないようにする
            existing = conn.execute(
                """
                SELECT id FROM pending_orders
                WHERE ticker = ? AND signal_date = ? AND status = 'PENDING'
                """,
                (ticker, signal_date),
            ).fetchone()
            if existing:
                logger.info("既存の予約注文があるためスキップ: %s %s", ticker, signal_date)
                return

            conn.execute(
                """
                INSERT INTO pending_orders(
                    ticker, side, shares, reason, signal_date, created_at, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
                """,
                (ticker, side, int(shares), reason, signal_date, now),
            )
            logger.info(
                "予約注文: %s %s %d株 (signal_date=%s)",
                side,
                ticker,
                shares,
                signal_date,
            )
    except Exception as e:
        log_exception(logger, "予約注文の保存失敗", e)


def list_pending_orders(db_path: Path | None = None) -> list[dict[str, Any]]:
    try:
        with get_connection(db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, ticker, side, shares, reason, signal_date, created_at, status
                FROM pending_orders
                WHERE status = 'PENDING'
                ORDER BY id ASC
                """
            ).fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        log_exception(logger, "予約注文一覧取得失敗", e)
        return []


def mark_pending_order(order_id: int, status: str, db_path: Path | None = None) -> None:
    try:
        with get_connection(db_path) as conn:
            conn.execute(
                "UPDATE pending_orders SET status = ? WHERE id = ?",
                (status, order_id),
            )
    except Exception as e:
        log_exception(logger, f"予約注文ステータス更新失敗 ({order_id})", e)


def record_equity(
    as_of: str,
    cash: float,
    equity: float,
    note: str = "",
    db_path: Path | None = None,
) -> None:
    try:
        with get_connection(db_path) as conn:
            conn.execute(
                """
                INSERT INTO equity_history(as_of, cash, equity, note)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(as_of) DO UPDATE SET
                    cash = excluded.cash,
                    equity = excluded.equity,
                    note = excluded.note
                """,
                (as_of, float(cash), float(equity), note),
            )
    except Exception as e:
        log_exception(logger, "資産履歴の保存失敗", e)


def list_equity_history(db_path: Path | None = None) -> list[dict[str, Any]]:
    try:
        with get_connection(db_path) as conn:
            rows = conn.execute(
                """
                SELECT as_of, cash, equity, note
                FROM equity_history
                ORDER BY as_of ASC
                """
            ).fetchall()
            return [dict(r) for r in rows]
    except Exception as e:
        log_exception(logger, "資産履歴取得失敗", e)
        return []


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== db.py 動作確認 ===")
    # 確認用に一時DBを使う（本番 trades.db を汚さない）
    test_db = DB_PATH.parent / "test_trades.db"
    if test_db.exists():
        test_db.unlink()

    init_db(test_db)
    print(f"DB作成: {test_db}")
    print(f"初期現金: {get_cash(test_db):,.0f}")

    insert_trade(
        traded_at="2024-01-05",
        ticker="7203.T",
        side="BUY",
        price=2500.0,
        shares=100,
        reason="動作確認用ダミー",
        equity=INITIAL_CASH,
        signal_date="2024-01-04",
        db_path=test_db,
    )
    upsert_position("7203.T", shares=100, avg_price=2500.0, db_path=test_db)
    record_equity("2024-01-05", cash=INITIAL_CASH - 250_000, equity=INITIAL_CASH, db_path=test_db)

    trades = list_trades(test_db)
    positions = get_all_positions(test_db)
    print(f"取引件数: {len(trades)}")
    print(f"ポジション: {positions}")
    print("成功。test_trades.db は確認後に削除して構いません。")
