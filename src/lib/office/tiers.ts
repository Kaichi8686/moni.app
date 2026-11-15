import { OFFICE_LEAGUE_ORDER } from "@/lib/office/constants";
import type { OfficeLeagueId } from "@/lib/office/types";

export type OfficeLeagueMeta = {
  id: OfficeLeagueId;
  labelJa: string;
  crown: string;
  accent: string;
};

/** 既存リーグの見た目を流用し、最下位に新人を追加 */
export const OFFICE_LEAGUE_META: Record<OfficeLeagueId, OfficeLeagueMeta> = {
  rookie: {
    id: "rookie",
    labelJa: "新人リーグ",
    crown: "🌱",
    accent: "#65A30D",
  },
  bronze: {
    id: "bronze",
    labelJa: "ブロンズリーグ",
    crown: "🥉",
    accent: "#B45309",
  },
  silver: {
    id: "silver",
    labelJa: "シルバーリーグ",
    crown: "🥈",
    accent: "#64748B",
  },
  gold: {
    id: "gold",
    labelJa: "ゴールドリーグ",
    crown: "🥇",
    accent: "#CA8A04",
  },
  platinum: {
    id: "platinum",
    labelJa: "プラチナリーグ",
    crown: "💠",
    accent: "#0E7490",
  },
  diamond: {
    id: "diamond",
    labelJa: "ダイヤモンドリーグ",
    crown: "💎",
    accent: "#4F46E5",
  },
};

export function parseOfficeLeagueId(raw: unknown): OfficeLeagueId {
  const s = String(raw ?? "").toLowerCase();
  if ((OFFICE_LEAGUE_ORDER as string[]).includes(s)) return s as OfficeLeagueId;
  return "rookie";
}

export function nextOfficeLeague(id: OfficeLeagueId): OfficeLeagueId | null {
  const i = OFFICE_LEAGUE_ORDER.indexOf(id);
  if (i < 0 || i >= OFFICE_LEAGUE_ORDER.length - 1) return null;
  return OFFICE_LEAGUE_ORDER[i + 1] ?? null;
}

export function prevOfficeLeague(id: OfficeLeagueId): OfficeLeagueId | null {
  const i = OFFICE_LEAGUE_ORDER.indexOf(id);
  if (i <= 0) return null;
  return OFFICE_LEAGUE_ORDER[i - 1] ?? null;
}

/** 上位/下位 20% の人数（最低1人、端数切り上げ） */
export function promotionDemotionSlots(count: number): { promote: number; demote: number } {
  if (count <= 0) return { promote: 0, demote: 0 };
  const n = Math.max(1, Math.ceil(count * 0.2));
  // 少人数で昇格・降格が被らないよう調整
  if (count === 1) return { promote: 0, demote: 0 };
  if (n * 2 >= count) {
    const promote = Math.max(1, Math.floor(count / 2));
    const demote = Math.max(0, count - promote - Math.max(0, count - promote * 2));
    return { promote, demote: Math.min(demote, count - promote) };
  }
  return { promote: n, demote: n };
}
