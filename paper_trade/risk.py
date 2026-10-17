"""
risk.py
-------
AIや戦略とは独立したリスク管理。

役割はただ2つ:
1. 1銘柄の上限比率を超える買いを拒否する
2. 全体の損失が初期資金の -15% に達したら、全ポジション決済して停止する

戦略が「買い」と言っても、ここがダメなら買わない。
バックテストでもペーパートレードでも、同じ関数を通す。

動作確認:
    cd paper_trade
    python3 risk.py
"""

from __future__ import annotations

from dataclasses import dataclass

from config import INITIAL_CASH, MAX_LOSS_RATIO, MAX_POSITION_RATIO
from logging_utils import get_logger

logger = get_logger(__name__)


@dataclass
class BuyCheckResult:
    """買い注文の可否チェック結果。"""

    allowed: bool
    reason: str
    # 実際に買ってよい株数（拒否時は 0）
    allowed_shares: int = 0


@dataclass
class StopCheckResult:
    """全体損失による停止判定の結果。"""

    should_stop: bool
    reason: str
    loss_ratio: float


def max_shares_for_ticker(
    equity: float,
    price: float,
    current_position_value: float = 0.0,
    max_ratio: float = MAX_POSITION_RATIO,
) -> int:
    """
    ある銘柄について、上限比率の範囲内で買える最大株数を返す。

    Parameters
    ----------
    equity : いまの資産総額（現金 + 保有株の時価）
    price  : 1株あたりの想定約定価格
    current_position_value : すでにその銘柄を持っている場合の時価
    max_ratio : 1銘柄の上限比率
    """
    if equity <= 0 or price <= 0:
        return 0

    # この銘柄に割いてよい上限金額
    max_value = equity * max_ratio
    # まだ追加で買える余地
    remaining_budget = max_value - current_position_value
    if remaining_budget <= 0:
        return 0

    # 日本株は通常100株単位だが、実験の簡単さ優先で1株単位も許可する
    # （厳密な単元株ルールは後で足せる）
    return int(remaining_budget // price)


def check_buy_allowed(
    equity: float,
    price: float,
    requested_shares: int,
    current_position_value: float = 0.0,
    max_ratio: float = MAX_POSITION_RATIO,
) -> BuyCheckResult:
    """
    買い注文がリスクルールを満たすか判定する。

    - 上限を超える数量は拒否、または縮小して許可したい場合は
      allowed_shares を見て呼び出し側で調整できる
    - ここでは「要求数量が上限内なら許可、超えなら拒否（0株）」とする
      （自動で数量を削って買うかは paper_trade / backtest 側の方針）
    """
    if requested_shares <= 0:
        return BuyCheckResult(False, "買い数量が0以下です", 0)

    if price <= 0:
        return BuyCheckResult(False, "価格が不正です", 0)

    allowed = max_shares_for_ticker(
        equity=equity,
        price=price,
        current_position_value=current_position_value,
        max_ratio=max_ratio,
    )

    if allowed <= 0:
        reason = (
            f"1銘柄上限比率 {max_ratio:.0%} に達しているため買い拒否 "
            f"(資産={equity:,.0f}, 既存ポジション時価={current_position_value:,.0f})"
        )
        logger.info(reason)
        return BuyCheckResult(False, reason, 0)

    if requested_shares > allowed:
        reason = (
            f"要求数量 {requested_shares} 株は上限超過。上限内は {allowed} 株 "
            f"(上限比率={max_ratio:.0%})"
        )
        logger.info(reason)
        # 呼び出し側が縮小購入できるように、許可株数は返す
        return BuyCheckResult(False, reason, allowed)

    reason = f"買い許可: {requested_shares} 株（上限 {allowed} 株以内）"
    return BuyCheckResult(True, reason, requested_shares)


def check_portfolio_stop(
    equity: float,
    initial_cash: float = INITIAL_CASH,
    max_loss_ratio: float = MAX_LOSS_RATIO,
) -> StopCheckResult:
    """
    全体損失が初期資金の -max_loss_ratio に達したら停止フラグを立てる。

    例: 初期100万円、max_loss_ratio=0.15 → 資産が85万円以下で停止
    """
    if initial_cash <= 0:
        return StopCheckResult(True, "初期資金が不正なため停止", 1.0)

    loss_ratio = (initial_cash - equity) / initial_cash
    if loss_ratio >= max_loss_ratio:
        reason = (
            f"全体損失が初期資金の -{max_loss_ratio:.0%} に到達 "
            f"(資産={equity:,.0f}, 損失率={loss_ratio:.2%})。全決済して停止。"
        )
        logger.warning(reason)
        return StopCheckResult(True, reason, loss_ratio)

    return StopCheckResult(
        False,
        f"停止ライン未到達（損失率={loss_ratio:.2%} / 上限={max_loss_ratio:.0%}）",
        loss_ratio,
    )


def clamp_buy_shares(
    equity: float,
    price: float,
    requested_shares: int,
    current_position_value: float = 0.0,
    cash: float | None = None,
) -> tuple[int, str]:
    """
    買い数量をリスク上限（と現金）に収まるよう自動調整する便利関数。

    終値で見積もった数量を、実際の約定価格で静かに縮める用途を想定。
    （ログを汚さないよう、ここでは拒否ログを出さない）

    Returns
    -------
    (調整後株数, 理由)
    """
    if requested_shares <= 0 or price <= 0:
        return 0, "買い数量または価格が不正です"

    capped = max_shares_for_ticker(
        equity=equity,
        price=price,
        current_position_value=current_position_value,
    )
    shares = min(requested_shares, capped)
    reason = f"リスク上限内に調整: 要求{requested_shares}株 → {shares}株"

    if cash is not None and price > 0 and shares > 0:
        affordable = int(cash // price)
        if affordable < shares:
            reason = f"{reason} / 現金不足のため {shares}→{affordable} 株に縮小"
            shares = affordable

    if shares <= 0:
        return 0, "買える株数が0（上限または現金不足）"

    return shares, reason


# ---------------------------------------------------------------------------
# 単体動作確認用
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== risk.py 動作確認 ===")

    equity = INITIAL_CASH
    price = 3000.0

    # 上限ちょうど付近
    max_shares = max_shares_for_ticker(equity, price)
    print(f"初期資金 {equity:,.0f} 円、株価 {price:.0f} 円のとき")
    print(f"1銘柄上限 {MAX_POSITION_RATIO:.0%} で買える最大株数: {max_shares}")

    ok = check_buy_allowed(equity, price, requested_shares=max_shares)
    print(f"上限ちょうど: allowed={ok.allowed}, {ok.reason}")

    ng = check_buy_allowed(equity, price, requested_shares=max_shares + 1)
    print(f"上限超過: allowed={ng.allowed}, allowed_shares={ng.allowed_shares}")
    print(f"  理由: {ng.reason}")

    # 停止ライン
    alive = check_portfolio_stop(equity=900_000)
    print(f"\n資産90万円: should_stop={alive.should_stop} ({alive.reason})")

    dead = check_portfolio_stop(equity=840_000)
    print(f"資産84万円: should_stop={dead.should_stop} ({dead.reason})")
