import { PROMOTION_SLOTS } from "@/lib/idea-league/tiers";
import type { LeagueMember } from "@/lib/idea-league/types";

export type LeagueZone = "promote" | "stay" | "risk";

export type LeagueProgressSnapshot = {
  myScore: number;
  myRank: number | null;
  promotionCutoff: number;
  stayRank: number;
  promotionLineScore: number;
  stayLineScore: number;
  pointsToPromotion: number;
  inPromotionZone: boolean;
  zone: LeagueZone;
  /** 0–100 current position on the gauge */
  fillPercent: number;
  promotionMarkerPercent: number;
  stayMarkerPercent: number;
  groupSize: number;
  maxScore: number;
  /** true when scores are tied/zero — gauge uses rank geometry */
  rankBased: boolean;
};

/** Map rank 1..N onto a left(low)→right(high) score-style axis (rank1 ≈ right). */
function rankToPercent(rank: number, groupSize: number): number {
  if (groupSize <= 1) return 88;
  const t = (groupSize - rank) / Math.max(groupSize - 1, 1);
  return Math.round(Math.min(96, Math.max(4, 8 + t * 84)));
}

export function computeLeagueProgress(
  members: LeagueMember[],
  promotionCutoff = PROMOTION_SLOTS,
): LeagueProgressSnapshot {
  const groupSize = Math.max(members.length, 1);
  const me = members.find((m) => m.isMe) ?? null;
  const myScore = Number(me?.voteScore) || 0;
  const myRank = me?.rank ?? (groupSize > 0 ? groupSize : null);

  const cutoffMember =
    members.find((m) => m.rank === promotionCutoff) ??
    members[Math.min(promotionCutoff, members.length) - 1] ??
    null;
  const promotionLineScore = Number(cutoffMember?.voteScore) || 0;

  const stayRank = Math.min(
    groupSize,
    Math.max(promotionCutoff + 1, Math.ceil(groupSize * 0.66) || promotionCutoff + 1),
  );
  const stayMember =
    members.find((m) => m.rank === stayRank) ?? members[members.length - 1] ?? null;
  const stayLineScore = Number(stayMember?.voteScore) || 0;

  const topScore = members.reduce((max, m) => Math.max(max, Number(m.voteScore) || 0), 0);
  const distinctScores = new Set(members.map((m) => Number(m.voteScore) || 0));
  const rankBased = topScore === 0 || distinctScores.size <= 1;

  const inPromotionZone = myRank !== null && myRank <= promotionCutoff;
  const inRiskZone = myRank !== null && myRank > stayRank;
  const zone: LeagueZone = inPromotionZone ? "promote" : inRiskZone ? "risk" : "stay";

  const pointsToPromotion = inPromotionZone
    ? 0
    : Math.max(0, promotionLineScore - myScore + (myScore < promotionLineScore ? 1 : 0));

  let fillPercent: number;
  let promotionMarkerPercent: number;
  let stayMarkerPercent: number;
  let maxScore: number;

  if (rankBased) {
    // Fixed readable geometry for 0pt / ties / tiny groups (eFootball-like).
    if (groupSize <= 1) {
      stayMarkerPercent = 34;
      promotionMarkerPercent = 66;
      fillPercent = 82; // solo sits in promo zone
    } else {
      const promoEdge = Math.max(1, Math.min(promotionCutoff, groupSize));
      const stayEdge = Math.max(promoEdge + 1, Math.min(stayRank, groupSize));
      promotionMarkerPercent = rankToPercent(promoEdge + 0.5, groupSize + 1);
      stayMarkerPercent = rankToPercent(stayEdge + 0.5, groupSize + 1);
      if (stayMarkerPercent >= promotionMarkerPercent - 12) {
        stayMarkerPercent = Math.max(16, promotionMarkerPercent - 24);
      }
      fillPercent = myRank != null ? rankToPercent(myRank, groupSize) : 50;
    }
    maxScore = 1;
  } else {
    maxScore = Math.max(topScore, promotionLineScore, myScore, 1) * 1.08;
    const toPercent = (score: number) =>
      Math.round(Math.min(100, Math.max(0, (score / maxScore) * 100)));
    fillPercent = toPercent(myScore);
    promotionMarkerPercent = toPercent(promotionLineScore);
    stayMarkerPercent = toPercent(stayLineScore);
    if (stayMarkerPercent >= promotionMarkerPercent) {
      stayMarkerPercent = Math.max(12, promotionMarkerPercent - 18);
    }
  }

  return {
    myScore,
    myRank,
    promotionCutoff,
    stayRank,
    promotionLineScore,
    stayLineScore,
    pointsToPromotion,
    inPromotionZone,
    zone,
    fillPercent,
    promotionMarkerPercent,
    stayMarkerPercent,
    groupSize,
    maxScore,
    rankBased,
  };
}
