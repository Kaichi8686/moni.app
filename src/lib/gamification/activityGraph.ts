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
