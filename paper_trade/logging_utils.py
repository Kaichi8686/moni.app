"""
logging_utils.py
----------------
エラーが起きてもアプリ全体を止めず、ログファイルに残すための共通処理。

使い方の例:
    from logging_utils import get_logger, log_exception

    logger = get_logger(__name__)
    try:
        ...
    except Exception as e:
        log_exception(logger, "株価取得に失敗", e)
"""

from __future__ import annotations

import logging
from pathlib import Path

from config import LOG_DIR


def get_logger(name: str) -> logging.Logger:
    """
    名前付きロガーを返す。

    - コンソール（画面）と logs/app.log の両方に出力する
    - 同じ名前で何度呼んでも二重にハンドラを付けない
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    # すでに設定済みならそのまま返す（二重出力防止）
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    # ログの見た目: 時刻 / レベル / 名前 / メッセージ
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ファイルへ保存
    file_handler = logging.FileHandler(LOG_DIR / "app.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 画面にも出す
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    return logger


def log_exception(logger: logging.Logger, message: str, error: Exception) -> None:
    """
    例外をログに残す（プログラムは止めない想定で呼ぶ）。

    Parameters
    ----------
    logger : 使うロガー
    message : 何をしていたときに失敗したか
    error : 実際の例外オブジェクト
    """
    # exc_info=True でスタックトレースも一緒に残す
    logger.error("%s: %s", message, error, exc_info=True)


def ensure_dir(path: Path) -> Path:
    """ディレクトリが無ければ作って、同じ Path を返す。"""
    path.mkdir(parents=True, exist_ok=True)
    return path
