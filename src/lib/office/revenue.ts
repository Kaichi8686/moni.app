import { OFFICE_SIMILAR_REVENUE_FACTOR } from "@/lib/office/constants";
import { levelFromRevenue } from "@/lib/office/scoring";

/**
 * 売上計算を1か所に集約（将来のアイテム補正などをここに足す）
 * 売上 = AI総合点(0〜100) × size × 10（整数）
 * 類似提出時は ×0.3
 */
export function calcRevenue(input: {
  scoreTotal: number;
  size: 1 | 2 | 3;
  wasSimilar?: boolean;
}): number {
  const score = Math.max(0, Math.min(100, Math.round(input.scoreTotal)));
  const base = score * input.size * 10;
  if (input.wasSimilar) {
    return Math.floor(base * OFFICE_SIMILAR_REVENUE_FACTOR);
  }
  return Math.floor(base);
}

export function applyRevenueGrowth(totalRevenue: number, gained: number): {
  totalRevenue: number;
  level: number;
} {
  const next = Math.max(0, totalRevenue + Math.max(0, gained));
  return { totalRevenue: next, level: levelFromRevenue(next) };
}
