import { OFFICE_PEER_REPORT_HIDE_AT } from "@/lib/office/scenes";
import { tokyoDateKey } from "@/lib/office/loginStreak";

export type PeerSolution = {
  id: string;
  answer: string;
  strategyTitle: string | null;
  scoreTotal: number;
  voteCount: number;
  votedByMe: boolean;
  reportedByMe: boolean;
};

export type PeerVoteState = {
  dayKey: string;
  votesToday: number;
};

export const OFFICE_PEER_VOTES_PER_DAY = 3;

export function peerDayKey(now: Date = new Date()): string {
  return tokyoDateKey(now);
}

export function shouldHidePeer(reportCount: number): boolean {
  return reportCount >= OFFICE_PEER_REPORT_HIDE_AT;
}

/** 回答の簡易マスキング（長文は省略） */
export function clipPeerAnswer(answer: string, max = 120): string {
  const t = answer.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
