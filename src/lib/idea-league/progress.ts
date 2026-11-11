import { PROMOTION_SLOTS } from "@/lib/idea-league/tiers";
import type { LeagueMember } from "@/lib/idea-league/types";

export type LeagueZone = "promote" | "stay" | "risk";

export type LeagueProgressSnapshot = {
  myScore: number;
  myRank: number | null;
  promotionCutoff: number;
  promotionLineScore: number;
  stayLineScore: number;
  /** Points still needed to reach the promotion line (0 if already in zone). */
  pointsToPromotion: number;
  inPromotionZone: boolean;
  zone: LeagueZone;
  /** 0–100 fill for the gauge (current score) */
  fillPercent: number;
  /** Marker positions 0–100 on the score axis */
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
  const myScore = Number(me?.voteScore) || 0;
  const myRank = me?.rank ?? null;

  const cutoffMember =
    members.find((m) => m.rank === promotionCutoff) ??
    members[Math.min(promotionCutoff, members.length) - 1] ??
    null;
  const promotionLineScore = Number(cutoffMember?.voteScore) || 0;

  // Soft stay / risk boundary: lower third of the table (eFootball-like residual band).
  const stayRank = Math.min(
    groupSize,
    Math.max(promotionCutoff + 1, Math.ceil(groupSize * 0.66)),
  );
  const stayMember =
    members.find((m) => m.rank === stayRank) ?? members[members.length - 1] ?? null;
  const stayLineScore = Number(stayMember?.voteScore) || 0;

  const topScore = members.reduce((max, m) => Math.max(max, Number(m.voteScore) || 0), 0);
  // Keep headroom so the promotion line isn't glued to 100%.
  const maxScore = Math.max(topScore, promotionLineScore, myScore, 1) * 1.05;

  const inPromotionZone = myRank !== null && myRank <= promotionCutoff;
  const inRiskZone = myRank !== null && myRank > stayRank;
  const zone: LeagueZone = inPromotionZone ? "promote" : inRiskZone ? "risk" : "stay";

  const pointsToPromotion = inPromotionZone
    ? 0
    : Math.max(0, promotionLineScore - myScore + (myScore < promotionLineScore ? 1 : 0));

  const toPercent = (score: number) =>
    Math.round(Math.min(100, Math.max(0, (score / maxScore) * 100)));

  return {
    myScore,
    myRank,
    promotionCutoff,
    promotionLineScore,
    stayLineScore,
    pointsToPromotion,
    inPromotionZone,
    zone,
    fillPercent: toPercent(myScore),
    promotionMarkerPercent: toPercent(promotionLineScore),
    stayMarkerPercent: toPercent(stayLineScore),
    groupSize,
    maxScore,
  };
}
