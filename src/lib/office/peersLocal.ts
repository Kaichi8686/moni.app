import {
  clipPeerAnswer,
  OFFICE_PEER_VOTES_PER_DAY,
  peerDayKey,
  shouldHidePeer,
  type PeerSolution,
} from "@/lib/office/peers";
import type { OfficeSceneId } from "@/lib/office/scenes";
import type { IncidentType } from "@/lib/office/types";

const KEY = "moni.office.peers.v1";

type PeerRow = {
  id: string;
  userId: string;
  scene: OfficeSceneId;
  type: IncidentType;
  answer: string;
  strategyTitle: string | null;
  scoreTotal: number;
  safe: boolean;
  shareOptOut: boolean;
};

type VoteRow = { voterId: string; submissionId: string; dayKey: string };
type ReportRow = { reporterId: string; submissionId: string };

type PeerStore = {
  rows: PeerRow[];
  votes: VoteRow[];
  reports: ReportRow[];
};

function empty(): PeerStore {
  return { rows: [], votes: [], reports: [] };
}

function read(): PeerStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as PeerStore) };
  } catch {
    return empty();
  }
}

function write(store: PeerStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export function localPublishPeer(input: {
  id: string;
  userId: string;
  scene: OfficeSceneId;
  type: IncidentType;
  answer: string;
  strategyTitle: string | null;
  scoreTotal: number;
  shareOptOut?: boolean;
}) {
  const store = read();
  store.rows = store.rows.filter((r) => r.id !== input.id);
  store.rows.push({
    id: input.id,
    userId: input.userId,
    scene: input.scene,
    type: input.type,
    answer: input.answer,
    strategyTitle: input.strategyTitle,
    scoreTotal: input.scoreTotal,
    safe: true,
    shareOptOut: Boolean(input.shareOptOut),
  });
  write(store);
}

export function localListPeers(
  userId: string,
  scene: OfficeSceneId,
  type: IncidentType,
): PeerSolution[] {
  const store = read();
  const reportCount = new Map<string, number>();
  for (const r of store.reports) {
    reportCount.set(r.submissionId, (reportCount.get(r.submissionId) ?? 0) + 1);
  }
  const myVotes = new Set(
    store.votes.filter((v) => v.voterId === userId).map((v) => v.submissionId),
  );
  const myReports = new Set(
    store.reports.filter((r) => r.reporterId === userId).map((r) => r.submissionId),
  );
  const voteCount = new Map<string, number>();
  for (const v of store.votes) {
    voteCount.set(v.submissionId, (voteCount.get(v.submissionId) ?? 0) + 1);
  }

  return store.rows
    .filter(
      (r) =>
        r.scene === scene &&
        r.type === type &&
        r.safe &&
        !r.shareOptOut &&
        r.userId !== userId &&
        !shouldHidePeer(reportCount.get(r.id) ?? 0),
    )
    .sort((a, b) => b.scoreTotal - a.scoreTotal || (voteCount.get(b.id) ?? 0) - (voteCount.get(a.id) ?? 0))
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      answer: clipPeerAnswer(r.answer),
      strategyTitle: r.strategyTitle,
      scoreTotal: r.scoreTotal,
      voteCount: voteCount.get(r.id) ?? 0,
      votedByMe: myVotes.has(r.id),
      reportedByMe: myReports.has(r.id),
    }));
}

export function localVotePeer(userId: string, submissionId: string): PeerSolution[] {
  const store = read();
  const row = store.rows.find((r) => r.id === submissionId);
  if (!row) throw new Error("解決策が見つからないよ");
  const dayKey = peerDayKey();
  const todayVotes = store.votes.filter((v) => v.voterId === userId && v.dayKey === dayKey);
  if (todayVotes.some((v) => v.submissionId === submissionId)) {
    return localListPeers(userId, row.scene, row.type);
  }
  if (todayVotes.length >= OFFICE_PEER_VOTES_PER_DAY) {
    throw new Error(`投票は1日${OFFICE_PEER_VOTES_PER_DAY}回までだよ`);
  }
  store.votes.push({ voterId: userId, submissionId, dayKey });
  write(store);
  return localListPeers(userId, row.scene, row.type);
}

export function localReportPeer(userId: string, submissionId: string): PeerSolution[] {
  const store = read();
  const row = store.rows.find((r) => r.id === submissionId);
  if (!row) throw new Error("解決策が見つからないよ");
  if (!store.reports.some((r) => r.reporterId === userId && r.submissionId === submissionId)) {
    store.reports.push({ reporterId: userId, submissionId });
    write(store);
  }
  return localListPeers(userId, row.scene, row.type);
}
