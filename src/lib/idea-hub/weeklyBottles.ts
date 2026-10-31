/** Weekly Mon–Sat idea bottles — local persistence (Asia/Tokyo calendar). */

export type WeekdaySlot = 0 | 1 | 2 | 3 | 4 | 5; // Mon–Sat

export type GiftPatternId = "stripe" | "dots" | "plaid" | "ribbon" | "wave" | "spark";

export type BottledIdea = {
  id: string;
  weekId: string;
  slot: WeekdaySlot;
  giftPattern: GiftPatternId;
  title: string;
  answer: string;
  createdAt: string;
};

export type WeeklyBottleStore = {
  version: 1;
  bottles: BottledIdea[];
};

const STORAGE_KEY = "moni:weekly-idea-bottles:v1";
const TOKYO = "Asia/Tokyo";

export const WEEKDAY_LABELS_JA = ["月", "火", "水", "木", "金", "土"] as const;
export const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Bright isometric wraps — yellow ribbon like the reference gift */
export const GIFT_PATTERNS: Array<{
  id: GiftPatternId;
  labelJa: string;
  labelEn: string;
  wrap: string;
  ribbon: string;
  accent: string;
  base: string;
}> = [
  { id: "dots", labelJa: "あか", labelEn: "Red", wrap: "#E53935", ribbon: "#FFD54F", accent: "#FF8A65", base: "#B71C1C" },
  { id: "stripe", labelJa: "みどり", labelEn: "Green", wrap: "#43A047", ribbon: "#FFD54F", accent: "#AED581", base: "#2E7D32" },
  { id: "plaid", labelJa: "あお", labelEn: "Blue", wrap: "#1E88E5", ribbon: "#FFD54F", accent: "#64B5F6", base: "#1565C0" },
  { id: "ribbon", labelJa: "オレンジ", labelEn: "Orange", wrap: "#FB8C00", ribbon: "#FFD54F", accent: "#FFCC80", base: "#EF6C00" },
  { id: "wave", labelJa: "ピンク", labelEn: "Pink", wrap: "#EC407A", ribbon: "#FFD54F", accent: "#F8BBD0", base: "#C2185B" },
  { id: "spark", labelJa: "むらさき", labelEn: "Purple", wrap: "#8E24AA", ribbon: "#FFD54F", accent: "#CE93D8", base: "#6A1B9A" },
];

export const PROMPT_QUESTION = {
  ja: "今日、どんなアイデアが浮かんだ？",
  en: "What idea came to you today?",
} as const;

export const TITLE_QUESTION = {
  ja: "あなたのアイデアのタイトルは？",
  en: "What’s the title of your idea?",
} as const;

function tokyoParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday, // Mon, Tue, ...
  };
}

/** Monday date (Y-M-D) for the Tokyo calendar week containing `date`. */
export function mondayOfTokyoWeek(date = new Date()): { y: number; m: number; d: number; iso: string } {
  const { year, month, day, weekday } = tokyoParts(date);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[weekday] ?? 0;
  // Build UTC noon for the Tokyo Y-M-D, then subtract offset days
  const utcNoon = Date.UTC(year, month - 1, day, 3, 0, 0); // ~noon JST as UTC
  const mondayUtc = new Date(utcNoon - offset * 86400000);
  const mp = tokyoParts(mondayUtc);
  const iso = `${mp.year}-${String(mp.month).padStart(2, "0")}-${String(mp.day).padStart(2, "0")}`;
  return { y: mp.year, m: mp.month, d: mp.day, iso };
}

export function weekIdForDate(date = new Date()): string {
  return `w:${mondayOfTokyoWeek(date).iso}`;
}

/** Mon=0 … Sat=5; Sunday returns null (rest day). */
export function tokyoWeekdaySlot(date = new Date()): WeekdaySlot | null {
  const { weekday } = tokyoParts(date);
  const map: Record<string, WeekdaySlot | null> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: null,
  };
  return map[weekday] ?? null;
}

export function formatWeekRangeLabel(weekId: string, locale: "ja" | "en"): string {
  const iso = weekId.replace(/^w:/, "");
  const [ys, ms, ds] = iso.split("-").map(Number);
  if (!ys || !ms || !ds) return weekId;
  const start = new Date(Date.UTC(ys, ms - 1, ds, 3, 0, 0));
  const end = new Date(start.getTime() + 5 * 86400000);
  const sp = tokyoParts(start);
  const ep = tokyoParts(end);
  if (locale === "en") {
    return `${sp.month}/${sp.day} – ${ep.month}/${ep.day}`;
  }
  return `${sp.month}/${sp.day}〜${ep.month}/${ep.day}`;
}

const EMPTY_STORE: WeeklyBottleStore = { version: 1, bottles: [] };

/** Cached snapshot for useSyncExternalStore (must be referentially stable). */
let cachedStore: WeeklyBottleStore = EMPTY_STORE;
let cacheLoaded = false;

function loadStoreFromDisk(): WeeklyBottleStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as WeeklyBottleStore;
    if (parsed?.version !== 1 || !Array.isArray(parsed.bottles)) return EMPTY_STORE;
    return { version: 1, bottles: parsed.bottles };
  } catch {
    return EMPTY_STORE;
  }
}

export function invalidateWeeklyBottleCache() {
  cacheLoaded = false;
}

export function readWeeklyBottleStore(): WeeklyBottleStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  if (!cacheLoaded) {
    cachedStore = loadStoreFromDisk();
    cacheLoaded = true;
  }
  return cachedStore;
}

export function writeWeeklyBottleStore(store: WeeklyBottleStore) {
  if (typeof window === "undefined") return;
  cachedStore = store;
  cacheLoaded = true;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("moni-weekly-bottles-changed"));
}

export function listBottlesForWeek(weekId: string, store = readWeeklyBottleStore()): BottledIdea[] {
  return store.bottles.filter((b) => b.weekId === weekId).sort((a, b) => a.slot - b.slot);
}

export function listPastWeekIds(currentWeekId: string, store = readWeeklyBottleStore()): string[] {
  const ids = [...new Set(store.bottles.map((b) => b.weekId))].filter((id) => id !== currentWeekId);
  return ids.sort((a, b) => b.localeCompare(a));
}

export function getBottleForSlot(
  weekId: string,
  slot: WeekdaySlot,
  store = readWeeklyBottleStore(),
): BottledIdea | undefined {
  return store.bottles.find((b) => b.weekId === weekId && b.slot === slot);
}

export function upsertBottle(idea: BottledIdea): WeeklyBottleStore {
  const store = readWeeklyBottleStore();
  const next: WeeklyBottleStore = {
    version: 1,
    bottles: [
      ...store.bottles.filter((b) => !(b.weekId === idea.weekId && b.slot === idea.slot)),
      idea,
    ],
  };
  writeWeeklyBottleStore(next);
  return next;
}

export function newBottleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `bottle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
