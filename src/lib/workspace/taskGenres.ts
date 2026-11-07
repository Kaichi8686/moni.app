import type { LucideIcon } from "lucide-react";
import {
  Camera,
  ClipboardList,
  Hammer,
  Lightbulb,
  Megaphone,
  MessagesSquare,
  Music,
  PenLine,
  Star,
  Tag,
} from "lucide-react";
import type { BuiltinTaskGenre, CustomTaskGenreDef, TaskGenre } from "@/lib/workspace/types";

export const BUILTIN_TASK_GENRES = ["think", "make", "talk", "spread", "run"] as const satisfies readonly BuiltinTaskGenre[];

/** @deprecated Use BUILTIN_TASK_GENRES; kept for existing imports */
export const TASK_GENRES = BUILTIN_TASK_GENRES;

export type GenreDisplayMeta = {
  ja: string;
  en: string;
  hintJa: string;
  hintEn: string;
  icon: LucideIcon;
  chip: string;
  iconBg: string;
};

const BUILTIN_GENRE_META: Record<BuiltinTaskGenre, GenreDisplayMeta> = {
  think: {
    ja: "考える・書く",
    en: "Think & write",
    hintJa: "企画書・台本・リサーチなど",
    hintEn: "Plans, scripts, research",
    icon: PenLine,
    chip: "bg-indigo-50 text-indigo-700",
    iconBg: "bg-indigo-500",
  },
  make: {
    ja: "つくる",
    en: "Make",
    hintJa: "デザイン・工作・試作品など",
    hintEn: "Design, crafts, prototypes",
    icon: Hammer,
    chip: "bg-orange-50 text-orange-700",
    iconBg: "bg-orange-500",
  },
  talk: {
    ja: "話す・つなぐ",
    en: "Talk & connect",
    hintJa: "相談・予約・ドアリングなど",
    hintEn: "Conversations, bookings, outreach",
    icon: MessagesSquare,
    chip: "bg-sky-50 text-sky-700",
    iconBg: "bg-sky-500",
  },
  spread: {
    ja: "広める",
    en: "Spread the word",
    hintJa: "SNS投稿・チラシ・案内など",
    hintEn: "Posts, flyers, outreach",
    icon: Megaphone,
    chip: "bg-emerald-50 text-emerald-700",
    iconBg: "bg-emerald-500",
  },
  run: {
    ja: "運営する",
    en: "Run it",
    hintJa: "予算・スケジュール・役割分担",
    hintEn: "Budget, schedule, roles",
    icon: ClipboardList,
    chip: "bg-violet-50 text-violet-700",
    iconBg: "bg-violet-500",
  },
};

export const CUSTOM_COLOR_PRESETS: Array<Pick<GenreDisplayMeta, "chip" | "iconBg">> = [
  { chip: "bg-rose-50 text-rose-700", iconBg: "bg-rose-500" },
  { chip: "bg-teal-50 text-teal-700", iconBg: "bg-teal-500" },
  { chip: "bg-amber-50 text-amber-800", iconBg: "bg-amber-500" },
  { chip: "bg-fuchsia-50 text-fuchsia-700", iconBg: "bg-fuchsia-500" },
  { chip: "bg-cyan-50 text-cyan-700", iconBg: "bg-cyan-500" },
  { chip: "bg-lime-50 text-lime-800", iconBg: "bg-lime-600" },
  { chip: "bg-indigo-50 text-indigo-700", iconBg: "bg-indigo-500" },
  { chip: "bg-orange-50 text-orange-700", iconBg: "bg-orange-500" },
];

export const CUSTOM_GENRE_ICON_PRESETS: Array<{ key: string; icon: LucideIcon; labelJa: string; labelEn: string }> = [
  { key: "tag", icon: Tag, labelJa: "タグ", labelEn: "Tag" },
  { key: "pen", icon: PenLine, labelJa: "ペン", labelEn: "Pen" },
  { key: "hammer", icon: Hammer, labelJa: "つくる", labelEn: "Make" },
  { key: "talk", icon: MessagesSquare, labelJa: "話す", labelEn: "Talk" },
  { key: "megaphone", icon: Megaphone, labelJa: "広める", labelEn: "Spread" },
  { key: "clipboard", icon: ClipboardList, labelJa: "運営", labelEn: "Ops" },
  { key: "camera", icon: Camera, labelJa: "カメラ", labelEn: "Camera" },
  { key: "music", icon: Music, labelJa: "音楽", labelEn: "Music" },
  { key: "lightbulb", icon: Lightbulb, labelJa: "ひらめき", labelEn: "Idea" },
  { key: "star", icon: Star, labelJa: "スター", labelEn: "Star" },
];

export const MAX_CUSTOM_TASK_GENRES = 12;
export const CUSTOM_TASK_GENRE_LABEL_MAX = 24;

const CUSTOM_ID_RE = /^custom_[a-z0-9]{4,24}$/;

export function isBuiltinTaskGenre(value: unknown): value is BuiltinTaskGenre {
  return typeof value === "string" && (BUILTIN_TASK_GENRES as readonly string[]).includes(value);
}

export function isCustomTaskGenreId(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_ID_RE.test(value);
}

export function isTaskGenre(value: unknown): value is TaskGenre {
  return isBuiltinTaskGenre(value) || isCustomTaskGenreId(value);
}

export function createCustomTaskGenreId(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `custom_${suffix}`;
}

export function normalizeCustomTaskGenreLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, CUSTOM_TASK_GENRE_LABEL_MAX);
}

export function parseCustomTaskGenres(raw: unknown): CustomTaskGenreDef[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomTaskGenreDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!isCustomTaskGenreId(id) || seen.has(id)) continue;
    const labelJa = normalizeCustomTaskGenreLabel(typeof o.labelJa === "string" ? o.labelJa : "");
    if (!labelJa) continue;
    const labelEn =
      typeof o.labelEn === "string" && o.labelEn.trim()
        ? normalizeCustomTaskGenreLabel(o.labelEn)
        : undefined;
    const hintJa =
      typeof o.hintJa === "string" && o.hintJa.trim() ? o.hintJa.trim().slice(0, 60) : undefined;
    const hintEn =
      typeof o.hintEn === "string" && o.hintEn.trim() ? o.hintEn.trim().slice(0, 60) : undefined;
    const colorKey =
      typeof o.colorKey === "string" && o.colorKey.trim() ? o.colorKey.trim().slice(0, 32) : undefined;
    const iconKeyRaw = typeof o.iconKey === "string" ? o.iconKey.trim().slice(0, 24) : "";
    const iconKey = CUSTOM_GENRE_ICON_PRESETS.some((p) => p.key === iconKeyRaw) ? iconKeyRaw : undefined;
    const phaseIdRaw = typeof o.phaseId === "string" ? o.phaseId.trim() : "";
    const phaseId = phaseIdRaw.length > 0 ? phaseIdRaw.slice(0, 64) : undefined;
    seen.add(id);
    out.push({ id, labelJa, labelEn, hintJa, hintEn, colorKey, iconKey, phaseId });
    if (out.length >= MAX_CUSTOM_TASK_GENRES) break;
  }
  return out;
}

export function resolveCustomGenreIcon(iconKey?: string): LucideIcon {
  const hit = CUSTOM_GENRE_ICON_PRESETS.find((p) => p.key === iconKey);
  return hit?.icon ?? Tag;
}

/** ジャンルがこのステップ向けか（legacy の phaseId なしはどのステップでも使える） */
export function customGenreMatchesPhase(
  def: CustomTaskGenreDef,
  phaseId: string | null,
): boolean {
  if (!def.phaseId) return true;
  return def.phaseId === phaseId;
}

function colorForCustom(def: CustomTaskGenreDef, index: number): Pick<GenreDisplayMeta, "chip" | "iconBg"> {
  if (def.colorKey) {
    const hit = CUSTOM_COLOR_PRESETS.find((p) => p.iconBg === def.colorKey);
    if (hit) return hit;
  }
  return CUSTOM_COLOR_PRESETS[index % CUSTOM_COLOR_PRESETS.length]!;
}

export function resolveGenreMeta(
  genre: TaskGenre,
  customs: CustomTaskGenreDef[] = [],
): GenreDisplayMeta {
  if (isBuiltinTaskGenre(genre)) return BUILTIN_GENRE_META[genre];
  const idx = customs.findIndex((c) => c.id === genre);
  const def = idx >= 0 ? customs[idx]! : undefined;
  const colors = colorForCustom(def ?? { id: genre, labelJa: genre }, idx >= 0 ? idx : 0);
  const label = def?.labelJa ?? genre.replace(/^custom_/, "");
  return {
    ja: label,
    en: def?.labelEn?.trim() || label,
    hintJa: def?.hintJa?.trim() || "自分で追加したジャンル",
    hintEn: def?.hintEn?.trim() || "Custom genre",
    icon: resolveCustomGenreIcon(def?.iconKey),
    chip: colors.chip,
    iconBg: colors.iconBg,
  };
}

/** Built-in genres + project customs + orphan genres already used on issues */
export function listProjectTaskGenres(
  customs: CustomTaskGenreDef[],
  issueGenres: Iterable<string> = [],
): TaskGenre[] {
  const out: TaskGenre[] = [...BUILTIN_TASK_GENRES];
  const seen = new Set<string>(out);
  for (const custom of customs) {
    if (seen.has(custom.id)) continue;
    seen.add(custom.id);
    out.push(custom.id);
  }
  for (const raw of issueGenres) {
    if (!isTaskGenre(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/**
 * ステップに紐づくジャンル一覧。
 * - ビルトイン（そのステップで課題を作る導線）
 * - そのステップ向け／legacy（phaseId なし）のカスタムジャンル
 * - そのステップの課題で使われているオーファンジャンル
 */
export function listStepTaskGenres(
  phaseId: string | null,
  customs: CustomTaskGenreDef[],
  issues: Iterable<{ genre: string; phaseId?: string }>,
): TaskGenre[] {
  const phaseIssueGenres: string[] = [];
  for (const issue of issues) {
    if ((issue.phaseId ?? null) !== phaseId) continue;
    phaseIssueGenres.push(issue.genre);
  }
  const customsForStep = customs.filter((def) => customGenreMatchesPhase(def, phaseId));
  return listProjectTaskGenres(customsForStep, phaseIssueGenres);
}

export function nextCustomColorKey(existingCount: number): string {
  return CUSTOM_COLOR_PRESETS[existingCount % CUSTOM_COLOR_PRESETS.length]!.iconBg;
}
