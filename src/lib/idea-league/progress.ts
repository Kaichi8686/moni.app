import {
  AI_DEMOTION_LINE,
  AI_PROMOTION_LINE,
  AI_SCORE_CAP,
  AI_STAY_LINE,
} from "@/lib/idea-league/aiReview";
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
  demotionLineScore: number;
  pointsToPromotion: number;
  inPromotionZone: boolean;
  zone: LeagueZone;
  /** 0–100 current position on the gauge */
  fillPercent: number;
  promotionMarkerPercent: number;
  stayMarkerPercent: number;
  demotionMarkerPercent: number;
  groupSize: number;
  maxScore: number;
  /** true when scores are tied/zero — gauge uses rank geometry */
  rankBased: boolean;
  /** AI / ops fixed thresholds drive the three lines */
  aiThresholds: boolean;
};

/** Map rank 1..N onto a left(low)→right(high) score-style axis (rank1 ≈ right). */
function rankToPercent(rank: number, groupSize: number): number {
  if (groupSize <= 1) return 88;
  const t = (groupSize - rank) / Math.max(groupSize - 1, 1);
  return Math.round(Math.min(96, Math.max(4, 8 + t * 84)));
}

function scoreToPercent(score: number, maxScore: number): number {
  return Math.round(Math.min(100, Math.max(0, (score / Math.max(maxScore, 1)) * 100)));
}

export function computeLeagueProgress(
  members: LeagueMember[],
  promotionCutoff = PROMOTION_SLOTS,
  opts?: { preferAiThresholds?: boolean },
): LeagueProgressSnapshot {
  const groupSize = Math.max(members.length, 1);
  const me = members.find((m) => m.isMe) ?? null;
  const myScore = Number(me?.voteScore) || 0;
  const myRank = me?.rank ?? (groupSize > 0 ? groupSize : null);

  const cutoffMember =
    members.find((m) => m.rank === promotionCutoff) ??
    members[Math.min(promotionCutoff, members.length) - 1] ??
    null;

  const stayRank = Math.min(
    groupSize,
    Math.max(promotionCutoff + 1, Math.ceil(groupSize * 0.66) || promotionCutoff + 1),
  );
  const stayMember =
    members.find((m) => m.rank === stayRank) ?? members[members.length - 1] ?? null;

  const topScore = members.reduce((max, m) => Math.max(max, Number(m.voteScore) || 0), 0);
  const distinctScores = new Set(members.map((m) => Number(m.voteScore) || 0));
  const rankBased = topScore === 0 || distinctScores.size <= 1;

  // Prefer fixed AI lines whenever any positive score exists (early-phase 勝ち点).
  const aiThresholds = Boolean(opts?.preferAiThresholds) || topScore > 0;

  let promotionLineScore: number;
  let stayLineScore: number;
  let demotionLineScore: number;
  let fillPercent: number;
  let promotionMarkerPercent: number;
  let stayMarkerPercent: number;
  let demotionMarkerPercent: number;
  let maxScore: number;
  let zone: LeagueZone;
  let inPromotionZone: boolean;
  let pointsToPromotion: number;

  if (aiThresholds && !rankBased) {
    promotionLineScore = AI_PROMOTION_LINE;
    stayLineScore = AI_STAY_LINE;
    demotionLineScore = AI_DEMOTION_LINE;
    maxScore = Math.max(AI_SCORE_CAP, topScore, myScore) * 1.05;
    fillPercent = scoreToPercent(myScore, maxScore);
    promotionMarkerPercent = scoreToPercent(promotionLineScore, maxScore);
    stayMarkerPercent = scoreToPercent(stayLineScore, maxScore);
    demotionMarkerPercent = scoreToPercent(demotionLineScore, maxScore);
    inPromotionZone = myScore >= promotionLineScore;
    zone =
      myScore >= promotionLineScore ? "promote" : myScore >= stayLineScore ? "stay" : "risk";
    pointsToPromotion = inPromotionZone ? 0 : Math.max(0, promotionLineScore - myScore);
  } else if (aiThresholds && rankBased && myScore > 0) {
    // Solo / tied but already scored by AI — still use fixed lines.
    promotionLineScore = AI_PROMOTION_LINE;
    stayLineScore = AI_STAY_LINE;
    demotionLineScore = AI_DEMOTION_LINE;
    maxScore = AI_SCORE_CAP * 1.05;
    fillPercent = scoreToPercent(myScore, maxScore);
    promotionMarkerPercent = scoreToPercent(promotionLineScore, maxScore);
    stayMarkerPercent = scoreToPercent(stayLineScore, maxScore);
    demotionMarkerPercent = scoreToPercent(demotionLineScore, maxScore);
    inPromotionZone = myScore >= promotionLineScore;
    zone =
      myScore >= promotionLineScore ? "promote" : myScore >= stayLineScore ? "stay" : "risk";
    pointsToPromotion = inPromotionZone ? 0 : Math.max(0, promotionLineScore - myScore);
  } else if (rankBased) {
    promotionLineScore = Number(cutoffMember?.voteScore) || 0;
    stayLineScore = Number(stayMember?.voteScore) || 0;
    demotionLineScore = 0;
    maxScore = 1;
    if (groupSize <= 1) {
      demotionMarkerPercent = 22;
      stayMarkerPercent = 48;
      promotionMarkerPercent = 72;
      fillPercent = 78;
    } else {
      const promoEdge = Math.max(1, Math.min(promotionCutoff, groupSize));
      const stayEdge = Math.max(promoEdge + 1, Math.min(stayRank, groupSize));
      promotionMarkerPercent = rankToPercent(promoEdge + 0.5, groupSize + 1);
      stayMarkerPercent = rankToPercent(stayEdge + 0.5, groupSize + 1);
      demotionMarkerPercent = Math.max(12, stayMarkerPercent - 20);
      if (stayMarkerPercent >= promotionMarkerPercent - 12) {
        stayMarkerPercent = Math.max(28, promotionMarkerPercent - 22);
        demotionMarkerPercent = Math.max(12, stayMarkerPercent - 18);
      }
      fillPercent = myRank != null ? rankToPercent(myRank, groupSize) : 50;
    }
    inPromotionZone = myRank !== null && myRank <= promotionCutoff;
    const inRiskZone = myRank !== null && myRank > stayRank;
    zone = inPromotionZone ? "promote" : inRiskZone ? "risk" : "stay";
    pointsToPromotion = inPromotionZone
      ? 0
      : Math.max(0, promotionLineScore - myScore + (myScore < promotionLineScore ? 1 : 0));
  } else {
    promotionLineScore = Number(cutoffMember?.voteScore) || 0;
    stayLineScore = Number(stayMember?.voteScore) || 0;
    demotionLineScore = Math.max(0, Math.floor(stayLineScore * 0.45));
    maxScore = Math.max(topScore, promotionLineScore, myScore, 1) * 1.08;
    fillPercent = scoreToPercent(myScore, maxScore);
    promotionMarkerPercent = scoreToPercent(promotionLineScore, maxScore);
    stayMarkerPercent = scoreToPercent(stayLineScore, maxScore);
    demotionMarkerPercent = scoreToPercent(demotionLineScore, maxScore);
    if (stayMarkerPercent >= promotionMarkerPercent) {
      stayMarkerPercent = Math.max(18, promotionMarkerPercent - 18);
    }
    if (demotionMarkerPercent >= stayMarkerPercent - 8) {
      demotionMarkerPercent = Math.max(10, stayMarkerPercent - 16);
    }
    inPromotionZone = myRank !== null && myRank <= promotionCutoff;
    const inRiskZone = myRank !== null && myRank > stayRank;
    zone = inPromotionZone ? "promote" : inRiskZone ? "risk" : "stay";
    pointsToPromotion = inPromotionZone
      ? 0
      : Math.max(0, promotionLineScore - myScore + (myScore < promotionLineScore ? 1 : 0));
  }

  return {
    myScore,
    myRank,
    promotionCutoff,
    stayRank,
    promotionLineScore,
    stayLineScore,
    demotionLineScore,
    pointsToPromotion,
    inPromotionZone,
    zone,
    fillPercent,
    promotionMarkerPercent,
    stayMarkerPercent,
    demotionMarkerPercent,
    groupSize,
    maxScore,
    rankBased: rankBased && myScore === 0,
    aiThresholds,
  };
}
