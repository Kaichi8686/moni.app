import { PROMOTION_SLOTS } from "@/lib/idea-league/tiers";
import type { LeagueMember } from "@/lib/idea-league/types";

export type LeagueProgressSnapshot = {
  myScore: number;
  myRank: number | null;
  promotionCutoff: number;
  promotionLineScore: number;
  /** Points still needed to reach / hold the promotion line (0 if already in zone with buffer). */
  pointsToPromotion: number;
  inPromotionZone: boolean;
  /** 0–100 fill for the gauge */
  fillPercent: number;
  /** Marker positions 0–100 */
  promotionMarkerPercent: number;
  stayMarkerPercent: number;
  groupSize: number;
  maxScore: number;
};

export function computeLeagueProgress(
  members: LeagueMember[],
  promotionCutoff = PROMOTION_SLOTS,
): LeagueProgressSnapshot {
  const groupSize = Math.max(members.length, 1);
  const me = members.find((m) => m.isMe) ?? null;
  const myScore = me?.voteScore ?? 0;
  const myRank = me?.rank ?? null;

  const cutoffMember =
    members.find((m) => m.rank === promotionCutoff) ??
    members[Math.min(promotionCutoff, members.length) - 1] ??
    null;
  const promotionLineScore = cutoffMember?.voteScore ?? 0;

  const topScore = members.reduce((max, m) => Math.max(max, m.voteScore), 0);
  const maxScore = Math.max(topScore, promotionLineScore, myScore, 1);

  const inPromotionZone = myRank !== null && myRank <= promotionCutoff;
  const pointsToPromotion = inPromotionZone
    ? 0
    : Math.max(0, promotionLineScore - myScore + (myScore < promotionLineScore ? 1 : 0));

  // Soft "stay" line: midpoint between promotion cutoff and last place.
  const stayRank = Math.min(
    groupSize,
    Math.max(promotionCutoff + 1, Math.ceil((promotionCutoff + groupSize) / 2)),
  );
  const stayMember = members.find((m) => m.rank === stayRank) ?? members[members.length - 1] ?? null;
  const stayScore = stayMember?.voteScore ?? 0;

  const toPercent = (score: number) => Math.round(Math.min(100, Math.max(0, (score / maxScore) * 100)));

  return {
    myScore,
    myRank,
    promotionCutoff,
    promotionLineScore,
    pointsToPromotion,
    inPromotionZone,
    fillPercent: toPercent(myScore),
    promotionMarkerPercent: toPercent(promotionLineScore),
    stayMarkerPercent: toPercent(stayScore),
    groupSize,
    maxScore,
  };
}
