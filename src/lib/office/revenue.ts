import { OFFICE_SIMILAR_REVENUE_FACTOR } from "@/lib/office/constants";
import type { OfficeMeters } from "@/lib/office/meters";
import { metersRevenueMultiplier } from "@/lib/office/meters";
import { levelFromRevenue } from "@/lib/office/scoring";
import { originalBonus, strategyMultiplier } from "@/lib/office/strategy";
import type { StrategyKind } from "@/lib/office/types";

/**
 * 売上 = round(score × size × 10 × multiplier × (1 + original_bonus) × metersBonus)
 * 類似提出時は最後に ×0.3
 * 全メーター≥70 のとき metersBonus=1.1
 */
export function calcRevenue(input: {
  scoreTotal: number;
  size: 1 | 2 | 3;
  strategyKind: StrategyKind;
  strategyId: string;
  wasSimilar?: boolean;
  meters?: OfficeMeters | null;
}): { revenue: number; multiplier: number; isOriginal: boolean; originalBonus: number } {
  const score = Math.max(0, Math.min(100, Math.round(input.scoreTotal)));
  const multiplier = strategyMultiplier(input.strategyKind, score);
  const bonus = originalBonus(input.strategyId, score);
  const isOriginal = bonus > 0;
  const metersBonus = input.meters ? metersRevenueMultiplier(input.meters) : 1;
  let revenue = Math.round(score * input.size * 10 * multiplier * (1 + bonus) * metersBonus);
  if (input.wasSimilar) {
    revenue = Math.round(revenue * OFFICE_SIMILAR_REVENUE_FACTOR);
  }
  return { revenue, multiplier, isOriginal, originalBonus: bonus };
}

export function applyRevenueGrowth(totalRevenue: number, gained: number): {
  totalRevenue: number;
  level: number;
} {
  const next = Math.max(0, totalRevenue + Math.max(0, gained));
  return { totalRevenue: next, level: levelFromRevenue(next) };
}
