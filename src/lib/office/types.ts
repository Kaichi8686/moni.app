import type { OfficeIndustry } from "@/lib/office/industries";

export type OfficeLeagueId = "rookie" | "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type IncidentType = "pinch" | "chance" | "people" | "rival";
export type IncidentStatus = "open" | "solved";
export type SeasonResult = "promoted" | "demoted" | "stayed";

export type { OfficeIndustry };

export type OfficeCompany = {
  id: string;
  userId: string;
  name: string;
  /** プレイヤーが書いた会社の説明（事件生成の主コンテキスト） */
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
  createdAt: string;
};

export type OfficeScores = {
  solve: number;
  fun: number;
  feasible: number;
  total: number;
  comment: string;
};

export type OfficeSubmission = {
  id: string;
  userId: string;
  companyId: string;
  incidentId: string;
  answer: string;
  scoreSolve: number;
  scoreFun: number;
  scoreFeasible: number;
  scoreTotal: number;
  comment: string;
  revenue: number;
  wasSimilar: boolean;
  seasonKey: string;
  createdAt: string;
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
