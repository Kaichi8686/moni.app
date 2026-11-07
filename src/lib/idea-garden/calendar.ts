import type { WeekdayIndex } from "@/lib/idea-garden/types";

const TZ = "Asia/Tokyo";

/** QA: sessionStorage `moni.ideaGarden.forceDate` = YYYY-MM-DD で日付固定 */
export function gardenNow(): Date {
  if (typeof window !== "undefined") {
    try {
      const forced = window.sessionStorage.getItem("moni.ideaGarden.forceDate");
      if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) {
        return new Date(`${forced}T12:00:00+09:00`);
      }
    } catch {
      /* ignore */
    }
  }
  return new Date();
}

/** Asia/Tokyo の時刻部品 */
export function tokyoParts(date: Date = gardenNow()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateKey: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, dateKey };
}

/**
 * 花の「日」境界は毎朝 11:00（Asia/Tokyo）。
 * 11:00 未満はまだ前日の花として扱う。
 */
export const GARDEN_DAY_ROLLOVER_HOUR = 11;

export function gardenBusinessDateKey(date: Date = gardenNow()): string {
  const { dateKey, hour } = tokyoParts(date);
  if (hour < GARDEN_DAY_ROLLOVER_HOUR) return addDaysToDateKey(dateKey, -1);
  return dateKey;
}

/** Asia/Tokyo の YYYY-MM-DD（暦日。花の日替わりには gardenBusinessDateKey を使う） */
export function tokyoDateKey(date: Date = gardenNow()): string {
  return tokyoParts(date).dateKey;
}

/** Asia/Tokyo の曜日 (Sun=0 … Sat=6) — 暦日ベース */
export function tokyoWeekday(date: Date = gardenNow()): WeekdayIndex {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
  const map: Record<string, WeekdayIndex> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? 0;
}

/** 花の業務日キーに対する曜日 */
export function gardenBusinessWeekday(date: Date = gardenNow()): WeekdayIndex {
  const key = gardenBusinessDateKey(date);
  // 正午固定で曜日判定（境界ずれ防止）
  return tokyoWeekday(new Date(`${key}T12:00:00+09:00`));
}

export function isSunday(date: Date = gardenNow()): boolean {
  return gardenBusinessWeekday(date) === 0;
}

export function isGrowDay(date: Date = gardenNow()): boolean {
  const d = gardenBusinessWeekday(date);
  return d >= 1 && d <= 6;
}

/** その花の日が属する週の月曜 YYYY-MM-DD (Tokyo / 11時境界) */
export function weekKeyFor(date: Date = gardenNow()): string {
  const key = gardenBusinessDateKey(date);
  const weekday = gardenBusinessWeekday(date);
  // Monday = 1 → offset 0; Sunday = 0 → go back 6 days
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysToDateKey(key, -daysFromMonday);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Construct as UTC noon then adjust — dateKey is calendar date in Tokyo
  const utc = Date.UTC(y, m - 1, d + days, 12, 0, 0);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utc));
}

export function formatWeekLabel(weekKey: string, locale: "ja" | "en"): string {
  const end = addDaysToDateKey(weekKey, 6);
  if (locale === "en") {
    return `${weekKey} – ${end}`;
  }
  const [ys, ms, ds] = weekKey.split("-");
  const [, me, de] = end.split("-");
  return `${Number(ys)}年${Number(ms)}/${Number(ds)}〜${Number(me)}/${Number(de)}`;
}

export function weekdayLabel(weekday: WeekdayIndex, locale: "ja" | "en"): string {
  const ja = ["日", "月", "火", "水", "木", "金", "土"] as const;
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  return locale === "en" ? en[weekday] : `${ja[weekday]}曜`;
}
