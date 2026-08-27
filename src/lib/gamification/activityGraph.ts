import { todayKeyJapan } from "@/lib/projects/teamActivityStreak";

export type ActivityCell = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

const WEEKS = 52;

function levelFromCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 過去52週分の日別セル（日曜始まりの列×7行） */
export function buildActivityGrid(activityLog: Record<string, number>): ActivityCell[][] {
  const today = todayKeyJapan();
  const start = addDaysYmd(today, -(WEEKS * 7 - 1));
  const weeks: ActivityCell[][] = [];

  for (let w = 0; w < WEEKS; w++) {
    const col: ActivityCell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const date = addDaysYmd(start, w * 7 + dow);
      const count = activityLog[date] ?? 0;
      col.push({ date, count, level: levelFromCount(count) });
    }
    weeks.push(col);
  }
  return weeks;
}

export const ACTIVITY_LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-gray-100",
  1: "bg-green-100",
  2: "bg-green-300",
  3: "bg-green-500",
  4: "bg-green-700",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysYmd(ymd, -((wd + 6) % 7));
}

export type ActivityDay = { date: string; count: number };

export type MonthCell = {
  date: string | null;
  day: number | null;
  count: number;
  isToday: boolean;
};

export type ActivitySummary = {
  total: number;
  thisWeek: number;
  thisMonth: number;
  year: number;
  month: number;
  today: string;
  recent: ActivityDay[];
  monthCells: MonthCell[];
};

export function summarizeActivity(activityLog: Record<string, number>, now = new Date()): ActivitySummary {
  const today = todayKeyJapan(now);
  const [year, month] = today.split("-").map(Number);
  const monthPrefix = `${year}-${pad2(month)}`;
  const weekStart = mondayOfWeek(today);

  let total = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  const recent: ActivityDay[] = [];

  for (const [date, raw] of Object.entries(activityLog)) {
    const count = Number(raw) || 0;
    if (count <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    total += count;
    if (date.startsWith(monthPrefix)) thisMonth += count;
    if (date >= weekStart && date <= today) thisWeek += count;
    recent.push({ date, count });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date));

  return {
    total,
    thisWeek,
    thisMonth,
    year,
    month,
    today,
    recent: recent.slice(0, 8),
    monthCells: buildMonthCells(year, month, today, activityLog),
  };
}

function buildMonthCells(
  year: number,
  month: number,
  today: string,
  activityLog: Record<string, number>,
): MonthCell[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (firstDow + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ date: null, day: null, count: 0, isToday: false });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    cells.push({
      date,
      day,
      count: activityLog[date] ?? 0,
      isToday: date === today,
    });
  }
  return cells;
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;
const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatActivityDateJa(ymd: string): string {
  return formatActivityDate(ymd, "ja");
}

export function formatActivityDate(ymd: string, locale: "ja" | "en" = "ja"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (locale === "en") {
    return `${WEEKDAY_EN[wd]}, ${m}/${d}`;
  }
  return `${m}月${d}日（${WEEKDAY_JA[wd]}）`;
}
