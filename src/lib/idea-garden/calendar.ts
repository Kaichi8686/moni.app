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

/** Asia/Tokyo の YYYY-MM-DD */
export function tokyoDateKey(date: Date = gardenNow()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Asia/Tokyo の曜日 (Sun=0 … Sat=6) */
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

export function isSunday(date: Date = gardenNow()): boolean {
  return tokyoWeekday(date) === 0;
}

export function isGrowDay(date: Date = gardenNow()): boolean {
  const d = tokyoWeekday(date);
  return d >= 1 && d <= 6;
}

/** その日が属する週の月曜 YYYY-MM-DD (Tokyo) */
export function weekKeyFor(date: Date = gardenNow()): string {
  const key = tokyoDateKey(date);
  const weekday = tokyoWeekday(date);
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
