import { PROMOTION_SLOTS } from "@/lib/idea-league/tiers";

export type Rankable = {
  id: string;
  voteScore: number;
};

/** 票数降順・同点は id 昇順で安定ソートし、1始まりの順位を付与 */
export function rankByVotes<T extends Rankable>(
  items: T[],
  promotionCutoff = PROMOTION_SLOTS,
): Array<T & { rank: number; promoted: boolean }> {
  const sorted = [...items].sort((a, b) => {
    if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((item, i) => {
    const rank = i + 1;
    return { ...item, rank, promoted: rank <= promotionCutoff };
  });
}
