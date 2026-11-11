export type LeagueTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type LeagueWeekStatus = "upcoming" | "active" | "scoring" | "ended";

export type LeagueResultStatus = "pending" | "promoted" | "stayed" | "tutorial";

export type LeagueWeek = {
  id: string;
  weekKey: string;
  promptTitle: string;
  promptBody: string;
  startsAt: string;
  endsAt: string;
  status: LeagueWeekStatus;
};

export type LeagueMember = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  tier: LeagueTier;
  voteScore: number;
  rank: number;
  promoted: boolean;
  resultStatus: LeagueResultStatus;
  hasSubmission: boolean;
  isMe: boolean;
  /** 上位リーグのハイライト枠 */
  highlighted: boolean;
};

/** Early-phase AI / ops judgment (wins over peer votes while bootstrapping). */
export type LeagueAiReview = {
  score: number;
  commentJa: string;
  commentEn: string;
  reviewedAt: string;
  source: "ai" | "ops";
};

export type LeagueSubmission = {
  id: string;
  userId: string;
  membershipId: string;
  title: string;
  content: string;
  appeal: string | null;
  voteCount: number;
  votedByMe: boolean;
  authorName: string;
  authorAvatarUrl: string | null;
  isMe: boolean;
  highlighted: boolean;
  /** Present once judgment phase has scored this idea */
  aiReview: LeagueAiReview | null;
};

export type LeaguePhaseId = "waiting" | "submit" | "vote" | "results";

export type LeagueBattleState = {
  week: LeagueWeek;
  tier: LeagueTier;
  groupId: string;
  members: LeagueMember[];
  submissions: LeagueSubmission[];
  myMembershipId: string | null;
  mySubmission: LeagueSubmission | null;
  myVoteSubmissionId: string | null;
  promotionCutoff: number;
  demo: boolean;
  phase: LeaguePhaseId;
  /** 提出中は他者の解答を隠す */
  peersHidden: boolean;
  /** 結果カードに出す週（公表前は先週） */
  displayResultsWeekKey: string | null;
  seedPlantId: string | null;
};

export type LeagueHistoryEntry = {
  weekKey: string;
  promptTitle: string;
  tier: LeagueTier;
  rank: number | null;
  voteScore: number;
  resultStatus: LeagueResultStatus;
  endedAt: string;
};

export type LeagueProfileState = {
  userId: string;
  tier: LeagueTier;
  tutorialCompleted: boolean;
  promotions: number;
  highlight: boolean;
  history: LeagueHistoryEntry[];
};

export type LeagueTutorialResult = {
  title: string;
  content: string;
  mockRank: number;
  mockBoard: LeagueMember[];
  completedAt: string;
};

export type LeagueScreenMode = "tutorial" | "waiting" | "battle" | "results";
