import { addDaysToDateKey, tokyoDateKey, tokyoWeekday } from "@/lib/idea-garden/calendar";

const TZ = "Asia/Tokyo";

/** QA: sessionStorage `moni.ideaLeague.forceDate` = YYYY-MM-DD */
export function leagueNow(): Date {
  if (typeof window !== "undefined") {
    try {
      const forced = window.sessionStorage.getItem("moni.ideaLeague.forceDate");
      if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) {
        return new Date(`${forced}T12:00:00+09:00`);
      }
    } catch {
      /* ignore */
    }
  }
  return new Date();
}

export function isSaturday(date: Date = leagueNow()): boolean {
  return tokyoWeekday(date) === 6;
}

/** その土曜（または直近の土曜）の week_key = その日の YYYY-MM-DD */
export function saturdayWeekKey(date: Date = leagueNow()): string {
  const key = tokyoDateKey(date);
  const weekday = tokyoWeekday(date);
  // Sat=6 → offset 0; Sun=0 → back 1; Mon=1 → back 2 ... Fri=5 → back 6
  const daysFromSaturday = (weekday + 1) % 7;
  return addDaysToDateKey(key, -daysFromSaturday);
}

/** 次の土曜 00:00 Asia/Tokyo（今日が土曜なら今日） */
export function nextSaturdayStart(date: Date = leagueNow()): Date {
  const key = tokyoDateKey(date);
  const weekday = tokyoWeekday(date);
  const daysUntil = weekday === 6 ? 0 : (6 - weekday + 7) % 7;
  const satKey = addDaysToDateKey(key, daysUntil);
  return new Date(`${satKey}T00:00:00+09:00`);
}

/** 次の「まだ始まっていない」土曜（今日が土曜なら来週）— 待機画面用 */
export function upcomingSaturdayStart(date: Date = leagueNow()): Date {
  if (!isSaturday(date)) return nextSaturdayStart(date);
  const key = tokyoDateKey(date);
  return new Date(`${addDaysToDateKey(key, 7)}T00:00:00+09:00`);
}

export function saturdayWindow(weekKey: string): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: new Date(`${weekKey}T00:00:00+09:00`),
    endsAt: new Date(`${weekKey}T23:59:59.999+09:00`),
  };
}

export function msUntil(target: Date, now: Date = leagueNow()): number {
  return Math.max(0, target.getTime() - now.getTime());
}

export function formatCountdown(ms: number): { days: number; hours: number; minutes: number; seconds: number; label: string } {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label =
    days > 0
      ? `${days}日 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return { days, hours, minutes, seconds, label };
}

export function formatTokyoClock(date: Date, locale: "ja" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
