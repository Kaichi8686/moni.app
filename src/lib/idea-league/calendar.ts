import { addDaysToDateKey, tokyoDateKey, tokyoParts, tokyoWeekday } from "@/lib/idea-garden/calendar";

const TZ = "Asia/Tokyo";
export const LEAGUE_ROLLOVER_HOUR = 11;

/**
 * Daily Idea League (Asia/Tokyo):
 * - New battle every day at 11:00
 * - Submit window: 24h (day 11:00 → next day 11:00)
 * - Previous day locks as results when the new day starts
 *
 * QA:
 * - `moni.ideaLeague.forceDate` = YYYY-MM-DD （正午固定）
 * - または YYYY-MM-DDTHH:mm （JST）
 */
export function leagueNow(): Date {
  if (typeof window !== "undefined") {
    try {
      const forced = window.sessionStorage.getItem("moni.ideaLeague.forceDate");
      if (forced) {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(forced)) {
          return new Date(`${forced}:00+09:00`);
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(forced)) {
          return new Date(`${forced}T12:00:00+09:00`);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return new Date();
}

export type LeaguePhase = "waiting" | "submit" | "vote" | "results";

export type LeagueSchedule = {
  /** Active battle day key YYYY-MM-DD (JST) */
  weekKey: string;
  phase: LeaguePhase;
  submitStart: Date;
  submitEnd: Date;
  voteStart: Date;
  resultsAt: Date;
  publishedWeekKey: string | null;
  displayResultsWeekKey: string | null;
  nextBoundary: Date;
};

function atHour(dateKey: string, hour: number): Date {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00+09:00`);
}

/** Active battle day: rolls at 11:00 JST every day. */
export function battleDayKey(date: Date = leagueNow()): string {
  const { dateKey, hour } = tokyoParts(date);
  if (hour < LEAGUE_ROLLOVER_HOUR) return addDaysToDateKey(dateKey, -1);
  return dateKey;
}

/** @deprecated use battleDayKey — kept for older call sites */
export function battleSaturdayKey(date: Date = leagueNow()): string {
  return battleDayKey(date);
}

export function scheduleFor(date: Date = leagueNow()): LeagueSchedule {
  const weekKey = battleDayKey(date);
  const submitStart = atHour(weekKey, LEAGUE_ROLLOVER_HOUR);
  const nextKey = addDaysToDateKey(weekKey, 1);
  const submitEnd = atHour(nextKey, LEAGUE_ROLLOVER_HOUR);
  const prevKey = addDaysToDateKey(weekKey, -1);
  const t = date.getTime();

  // Daily cadence: always in the active submit window for weekKey.
  let phase: LeaguePhase = "submit";
  let nextBoundary: Date = submitEnd;
  if (t < submitStart.getTime()) {
    phase = "waiting";
    nextBoundary = submitStart;
  }

  return {
    weekKey,
    phase,
    submitStart,
    submitEnd,
    voteStart: submitStart,
    resultsAt: submitEnd,
    publishedWeekKey: prevKey,
    displayResultsWeekKey: prevKey,
    nextBoundary,
  };
}

/** @deprecated */
export function isSaturday(date: Date = leagueNow()): boolean {
  return tokyoWeekday(date) === 6;
}

export function saturdayWeekKey(date: Date = leagueNow()): string {
  return battleDayKey(date);
}

export function upcomingSaturdayStart(date: Date = leagueNow()): Date {
  const s = scheduleFor(date);
  if (s.phase === "waiting") return s.submitStart;
  return s.submitEnd;
}

/** 24h window for a battle day key */
export function saturdayWindow(weekKey: string): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: atHour(weekKey, LEAGUE_ROLLOVER_HOUR),
    endsAt: atHour(addDaysToDateKey(weekKey, 1), LEAGUE_ROLLOVER_HOUR),
  };
}

/** Alias kept for call sites — judgment/results lock at submit end. */
export function voteWindow(weekKey: string): { startsAt: Date; endsAt: Date } {
  const end = atHour(addDaysToDateKey(weekKey, 1), LEAGUE_ROLLOVER_HOUR);
  return {
    startsAt: end,
    endsAt: atHour(addDaysToDateKey(weekKey, 2), LEAGUE_ROLLOVER_HOUR),
  };
}

export function msUntil(target: Date, now: Date = leagueNow()): number {
  return Math.max(0, target.getTime() - now.getTime());
}

export function formatCountdown(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
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

export { tokyoDateKey };
