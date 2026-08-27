/** 文化祭アイデア投票 — 1件のアイデア */
export type ProjectIdea = {
  id: string;
  text: string;
  votes: number;
  createdAt: string;
  /** 匿名モードOFFのときのみ保存 */
  authorName?: string;
  /** 投稿者ID（サーバー版。削除権限判定に使用） */
  authorId?: string | null;
};

/** 集計付きの表示用アイデア（サーバー共有版） */
export type IdeaWithTally = ProjectIdea & {
  /** 全メンバー合計の得票数 */
  votes: number;
  /** 投票した人数（ユニーク） */
  voters: number;
  /** 自分が入れた票数 */
  myVotes: number;
};

/** プロジェクト作成者が決める投票ルール */
export type IdeaVotingSettings = {
  /** 1人あたりの総投票数（基本は1） */
  votesPerPerson: number;
  /** 1つのアイデアに入れられる最大票（基本は1） */
  maxVotesPerIdea: number;
};

/** 投票イベント（複数テーマを並行して投票できる） */
export type IdeaVoteEvent = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string | null;
  closesAt: string | null;
  closed: boolean;
  anonymous: boolean;
  votesPerPerson: number;
  maxVotesPerIdea: number;
};

export function isVoteEventClosed(event: Pick<IdeaVoteEvent, "closed" | "closesAt">, now = Date.now()): boolean {
  if (event.closed) return true;
  if (!event.closesAt) return false;
  const t = new Date(event.closesAt).getTime();
  return Number.isFinite(t) && t <= now;
}

export const DEFAULT_IDEA_VOTING_SETTINGS: IdeaVotingSettings = {
  votesPerPerson: 1,
  maxVotesPerIdea: 1,
};

/** このブラウザでの投票状況 */
export type VoterState = {
  byIdea: Record<string, number>;
};

export function totalVotesUsed(state: VoterState): number {
  return Object.values(state.byIdea).reduce((sum, n) => sum + n, 0);
}

export function votesOnIdea(state: VoterState, ideaId: string): number {
  return state.byIdea[ideaId] ?? 0;
}

export function canCastVote(
  state: VoterState,
  ideaId: string,
  settings: IdeaVotingSettings,
): boolean {
  if (totalVotesUsed(state) >= settings.votesPerPerson) return false;
  if (votesOnIdea(state, ideaId) >= settings.maxVotesPerIdea) return false;
  return true;
}
