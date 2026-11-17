import type { CastMember } from "@/lib/office/cast";
import type { OfficeIndustry } from "@/lib/office/industries";
import type { OfficeMeters } from "@/lib/office/meters";
import type { ResultPanel } from "@/lib/office/resultPanels";
import type {
  CastEmotion,
  CastRole,
  MeterKey,
  OfficeSceneId,
} from "@/lib/office/scenes";

export type OfficeLeagueId = "rookie" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type IncidentType = "pinch" | "chance" | "people" | "rival";
export type IncidentStatus = "open" | "solved";
export type SeasonResult = "promoted" | "demoted" | "stayed";

export type StrategyKind = "safe" | "standard" | "bold" | "custom";
export type TargetFit = "good" | "ok" | "mismatch";
export type StoryTone = "great" | "ok" | "bitter";

export type { OfficeIndustry, CastMember, OfficeMeters, MeterKey, OfficeSceneId, CastRole, CastEmotion };

export type OfficeCompany = {
  id: string;
  userId: string;
  /** プレイヤーが書いた会社の説明（事件生成の主コンテキスト） */
  name: string;
  about: string | null;
  /** 演出用。説明から推定、または旧データの系統 */
  industry: OfficeIndustry | null;
  totalRevenue: number;
  level: number;
  rankingEnabled: boolean;
  stamina: number;
  staminaUpdatedAt: string;
  leagueId: OfficeLeagueId;
  createdAt: string;
  cast: CastMember[];
  meters: OfficeMeters;
  metersUpdatedAt: string | null;
  shareOptOut?: boolean;
  sfxMuted?: boolean;
  secretaryGuideDone?: boolean;
  loginStreak?: number;
};

export type IncidentStrategy = {
  id: string;
  kind: Exclude<StrategyKind, "custom">;
  title: string;
  summary: string;
};

/** サーバー内部（fit 付き） */
export type IncidentTargetInternal = {
  id: string;
  label: string;
  fit: TargetFit;
};

/** クライアント向け（fit なし） */
export type IncidentTargetPublic = {
  id: string;
  label: string;
};

export type IncidentSpeaker = {
  castRole: CastRole;
  emotion: CastEmotion;
};

export type OfficeIncident = {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  description: string;
  type: IncidentType;
  size: 1 | 2 | 3;
  status: IncidentStatus;
  strategies: IncidentStrategy[];
  /** API では fit を落とす。ローカル内部では fit を持ち得る */
  targets: IncidentTargetPublic[] | IncidentTargetInternal[];
  strategyRerolls: number;
  createdAt: string;
  scene?: OfficeSceneId | null;
  speaker?: IncidentSpeaker | null;
  line?: string | null;
  stakes?: string | null;
  metersAtRisk?: MeterKey[];
  followupOf?: string | null;
};

export type OfficeScores = {
  solve: number;
  fun: number;
  feasible: number;
  fit: number;
  total: number;
  comment: string;
  story: string;
  storyTone: StoryTone;
  nextHint: string;
};

export type OfficeSubmission = {
  id: string;
  userId: string;
  companyId: string;
  incidentId: string;
  answer: string;
  strategyId: string;
  strategyKind: StrategyKind;
  targetIds: string[];
  targetOtherText: string | null;
  scoreSolve: number;
  scoreFun: number;
  scoreFeasible: number;
  scoreFit: number;
  scoreTotal: number;
  comment: string;
  story: string;
  storyTone: StoryTone;
  nextHint: string;
  multiplier: number;
  isOriginal: boolean;
  revenue: number;
  wasSimilar: boolean;
  seasonKey: string;
  createdAt: string;
  /** 結果3コマ */
  panels?: ResultPanel[] | null;
  strategyTitle?: string | null;
  castMemberId?: string | null;
  npcLine?: string | null;
  reactionEmotion?: CastEmotion | null;
  metersDelta?: Partial<OfficeMeters> | null;
  safe?: boolean;
};

export type OfficeSeasonScore = {
  id: string;
  userId: string;
  seasonKey: string;
  leagueId: OfficeLeagueId;
  revenue: number;
  rank: number | null;
  result: SeasonResult | null;
  resultSeen: boolean;
  createdAt: string;
};

export type StaminaState = {
  value: number;
  updatedAt: Date;
  nextRecoverAt: Date | null;
};

export type RankingRow = {
  rank: number;
  companyName: string;
  revenue: number;
  userId: string;
  isMe?: boolean;
};

export type OfficeSubmitInput = {
  answer: string;
  strategyId: string;
  targetIds: string[];
  targetOtherText?: string | null;
};
