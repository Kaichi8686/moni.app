import { addDaysToDateKey, tokyoDateKey, tokyoParts, tokyoWeekday } from "@/lib/idea-garden/calendar";

const TZ = "Asia/Tokyo";
export const LEAGUE_ROLLOVER_HOUR = 11;

/**
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
  /** そのバトル週の土曜 YYYY-MM-DD */
  weekKey: string;
  phase: LeaguePhase;
  submitStart: Date;
  submitEnd: Date;
  voteStart: Date;
  resultsAt: Date;
  /** 結果公表済みの最新 weekKey（なければ null） */
  publishedWeekKey: string | null;
  /** 画面に出す「先週の結果」用 weekKey */
  displayResultsWeekKey: string | null;
  nextBoundary: Date;
};

function atHour(dateKey: string, hour: number): Date {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00+09:00`);
}

/** いま属している（または直近の）バトル週の土曜キー */
export function battleSaturdayKey(date: Date = leagueNow()): string {
  const { dateKey, hour } = tokyoParts(date);
  const weekday = tokyoWeekday(date);

  // 土曜 11:00 未満 → まだ前の週の結果期間側
  if (weekday === 6 && hour < LEAGUE_ROLLOVER_HOUR) {
    return addDaysToDateKey(dateKey, -7);
  }
  // 日曜〜金曜: 直近の土曜へ戻す
  // 土曜 11:00 以降: 今日
  const daysFromSaturday = weekday === 6 ? 0 : (weekday + 1) % 7;
  return addDaysToDateKey(dateKey, -daysFromSaturday);
}

export function scheduleFor(date: Date = leagueNow()): LeagueSchedule {
  const weekKey = battleSaturdayKey(date);
  const submitStart = atHour(weekKey, LEAGUE_ROLLOVER_HOUR);
  const sunKey = addDaysToDateKey(weekKey, 1);
  const wedKey = addDaysToDateKey(weekKey, 4);
  const submitEnd = atHour(sunKey, LEAGUE_ROLLOVER_HOUR);
  const voteStart = submitEnd;
  const resultsAt = atHour(wedKey, LEAGUE_ROLLOVER_HOUR);
  const nextSatKey = addDaysToDateKey(weekKey, 7);
  const nextSubmitStart = atHour(nextSatKey, LEAGUE_ROLLOVER_HOUR);

  const t = date.getTime();
  let phase: LeaguePhase;
  let nextBoundary: Date;
  if (t < submitStart.getTime()) {
    phase = "waiting";
    nextBoundary = submitStart;
  } else if (t < submitEnd.getTime()) {
    phase = "submit";
    nextBoundary = submitEnd;
  } else if (t < resultsAt.getTime()) {
    phase = "vote";
    nextBoundary = resultsAt;
  } else if (t < nextSubmitStart.getTime()) {
    phase = "results";
    nextBoundary = nextSubmitStart;
  } else {
    // 理論上 battleSaturdayKey が次週になる
    phase = "waiting";
    nextBoundary = nextSubmitStart;
  }

  const prevWeekKey = addDaysToDateKey(weekKey, -7);
  const publishedWeekKey =
    t >= resultsAt.getTime() ? weekKey : t >= atHour(addDaysToDateKey(prevWeekKey, 4), LEAGUE_ROLLOVER_HOUR).getTime()
      ? prevWeekKey
      : null;

  // 結果公表前は先週の結果を表示
  const displayResultsWeekKey =
    phase === "results" || (publishedWeekKey === weekKey) ? weekKey : publishedWeekKey ?? prevWeekKey;

  return {
    weekKey,
    phase,
    submitStart,
    submitEnd,
    voteStart,
    resultsAt,
    publishedWeekKey,
    displayResultsWeekKey,
    nextBoundary,
  };
}

/** @deprecated use scheduleFor().phase === "submit" etc. */
export function isSaturday(date: Date = leagueNow()): boolean {
  return tokyoWeekday(date) === 6;
}

export function saturdayWeekKey(date: Date = leagueNow()): string {
  return battleSaturdayKey(date);
}

export function upcomingSaturdayStart(date: Date = leagueNow()): Date {
  const s = scheduleFor(date);
  if (s.phase === "waiting" && date.getTime() < s.submitStart.getTime()) return s.submitStart;
  return atHour(addDaysToDateKey(s.weekKey, 7), LEAGUE_ROLLOVER_HOUR);
}

export function saturdayWindow(weekKey: string): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: atHour(weekKey, LEAGUE_ROLLOVER_HOUR),
    endsAt: atHour(addDaysToDateKey(weekKey, 1), LEAGUE_ROLLOVER_HOUR),
  };
}

export function voteWindow(weekKey: string): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: atHour(addDaysToDateKey(weekKey, 1), LEAGUE_ROLLOVER_HOUR),
    endsAt: atHour(addDaysToDateKey(weekKey, 4), LEAGUE_ROLLOVER_HOUR),
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
