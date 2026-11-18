/** Asia/Tokyo の日付キー YYYY-MM-DD */
export function tokyoDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function ymdAdd(key: string, days: number): string {
  const [y, m, d] = key.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type LoginStreakResult = {
  streak: number;
  lastDate: string;
  changed: boolean;
};

/**
 * 連続ログイン更新。同日は据え置き、昨日なら+1、それ以外は1にリセット。
 */
export function nextLoginStreak(
  prevStreak: number,
  lastDate: string | null | undefined,
  now: Date = new Date(),
): LoginStreakResult {
  const today = tokyoDateKey(now);
  const prev = Math.max(0, Math.floor(Number(prevStreak) || 0));
  if (lastDate === today) {
    return { streak: prev || 1, lastDate: today, changed: prev === 0 };
  }
  const yesterday = ymdAdd(today, -1);
  if (lastDate === yesterday) {
    return { streak: prev + 1, lastDate: today, changed: true };
  }
  return { streak: 1, lastDate: today, changed: true };
}
