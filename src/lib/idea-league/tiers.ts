import type { LeagueTier } from "@/lib/idea-league/types";

export const LEAGUE_TIERS: LeagueTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

export const PROMOTION_SLOTS = 3;
/** 同一ティア内グループの目安人数（実ユーザーのみ・ボットなし） */
export const LEAGUE_GROUP_SIZE = 15;

export type LeagueTierMeta = {
  id: LeagueTier;
  labelJa: string;
  labelEn: string;
  crown: string;
  badgeId: string;
  accent: string;
  glow: string;
  bar: string;
  descriptionJa: string;
  descriptionEn: string;
  perkJa: string;
  perkEn: string;
  specialSlots: number;
};

export const LEAGUE_TIER_META: Record<LeagueTier, LeagueTierMeta> = {
  bronze: {
    id: "bronze",
    labelJa: "ブロンズリーグ",
    labelEn: "Bronze League",
    crown: "🥉",
    badgeId: "league_bronze",
    accent: "#B45309",
    glow: "rgba(180, 83, 9, 0.22)",
    bar: "#D97706",
    descriptionJa: "アイデアの登竜門。毎日のお題で腕試し。",
    descriptionEn: "The entry gate — daily prompts to practice.",
    perkJa: "リーグ参加バッジ",
    perkEn: "League participant badge",
    specialSlots: 0,
  },
  silver: {
    id: "silver",
    labelJa: "シルバーリーグ",
    labelEn: "Silver League",
    crown: "🥈",
    badgeId: "league_silver",
    accent: "#64748B",
    glow: "rgba(100, 116, 139, 0.25)",
    bar: "#94A3B8",
    descriptionJa: "注目度アップ。プロフィールに銀の王冠が灯る。",
    descriptionEn: "More eyes on you — a silver crown on your profile.",
    perkJa: "プロフィール銀王冠 + 軽ハイライト",
    perkEn: "Silver crown + soft highlight",
    specialSlots: 1,
  },
  gold: {
    id: "gold",
    labelJa: "ゴールドリーグ",
    labelEn: "Gold League",
    crown: "🥇",
    badgeId: "league_gold",
    accent: "#CA8A04",
    glow: "rgba(202, 138, 4, 0.28)",
    bar: "#EAB308",
    descriptionJa: "特別応募枠が解放。企業・仲間からの視線が集まりやすい。",
    descriptionEn: "Unlock a special idea slot and attract more attention.",
    perkJa: "特別アイデア応募枠 ×1 + 金のハイライト",
    perkEn: "Special idea slot ×1 + gold highlight",
    specialSlots: 1,
  },
  platinum: {
    id: "platinum",
    labelJa: "プラチナリーグ",
    labelEn: "Platinum League",
    crown: "💠",
    badgeId: "league_platinum",
    accent: "#0E7490",
    glow: "rgba(14, 116, 144, 0.28)",
    bar: "#22D3EE",
    descriptionJa: "称号「プラチナ発想家」と特別枠×2。検索でも目立つ。",
    descriptionEn: "Title + two special slots. You stand out in discovery.",
    perkJa: "称号「プラチナ発想家」+ 特別枠 ×2",
    perkEn: "Title “Platinum Ideator” + slots ×2",
    specialSlots: 2,
  },
  diamond: {
    id: "diamond",
    labelJa: "ダイヤモンドリーグ",
    labelEn: "Diamond League",
    crown: "💎",
    badgeId: "league_diamond",
    accent: "#4F46E5",
    glow: "rgba(79, 70, 229, 0.3)",
    bar: "#818CF8",
    descriptionJa: "最高峰。限定エフェクトとホーム特集枠を獲得。",
    descriptionEn: "The peak — exclusive effects and home feature slot.",
    perkJa: "限定エフェクト + ホーム特集 + 特別枠 ×3",
    perkEn: "Exclusive effect + home feature + slots ×3",
    specialSlots: 3,
  },
};

export function parseLeagueTier(raw: unknown): LeagueTier {
  const s = String(raw ?? "").toLowerCase();
  if (s === "silver" || s === "gold" || s === "platinum" || s === "diamond") return s;
  return "bronze";
}

export function nextLeagueTier(tier: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.indexOf(tier);
  if (i < 0 || i >= LEAGUE_TIERS.length - 1) return null;
  return LEAGUE_TIERS[i + 1] ?? null;
}

export function previousLeagueTier(tier: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.indexOf(tier);
  if (i <= 0) return null;
  return LEAGUE_TIERS[i - 1] ?? null;
}

export function tierLabel(tier: LeagueTier, locale: "ja" | "en"): string {
  const m = LEAGUE_TIER_META[tier];
  return locale === "en" ? m.labelEn : m.labelJa;
}

export function isPromotionRank(rank: number, cutoff = PROMOTION_SLOTS): boolean {
  return rank >= 1 && rank <= cutoff;
}
