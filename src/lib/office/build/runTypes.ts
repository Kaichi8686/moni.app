import type { CardDef } from "@/lib/office/build/content/cards";
import type { EventDef } from "@/lib/office/build/content/events";
import type { OfficeMood } from "@/lib/office/build/mood";
import type { TriggerLogEntry } from "@/lib/office/build/score";

export type RunMode = "daily" | "free";
export type RunStatus = "started" | "diagnosed" | "finished" | "expired";

export type OfficeRun = {
  id: string;
  userId: string;
  companyId: string;
  mode: RunMode;
  dateKey: string;
  eventId: string;
  /** サーバー保持。クライアントには public だけ返す */
  event: EventDef;
  hand: CardDef[];
  hypothesisId: string | null;
  playedCardIds: string[] | null;
  adlibText: string | null;
  adlibMult: number | null;
  customers: number | null;
  price: number | null;
  mult: number | null;
  revenue: number | null;
  ratio: number | null;
  rank: "S" | "A" | "B" | "C" | null;
  coins: number | null;
  triggerLog: TriggerLogEntry[] | null;
  moodBefore: OfficeMood;
  moodAfter: OfficeMood | null;
  status: RunStatus;
  expiresAt: string;
  createdAt: string;
  finishedAt: string | null;
};

export type BuildCompanyState = {
  id: string;
  userId: string;
  name: string;
  about: string | null;
  industry: string | null;
  coins: number;
  mood: OfficeMood;
  streak: number;
  totalRevenue: number;
  level: number;
  stamina: number;
  staminaUpdatedAt: string;
  deckIds: string[];
  employeeIds: string[];
  termIds: string[];
  tutorialDone: boolean;
  rankingEnabled: boolean;
  sfxMuted: boolean;
  ownerName: string | null;
  recentRatios: number[];
};
