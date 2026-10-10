import { addDaysYmdJapan, normalizeYmdKey, todayKeyJapan } from "@/lib/projects/teamActivityStreak";

export type UserActivityState = {
  activityStreak: number;
  activityLastDate: string | null;
  activityLog: Record<string, number>;
};

export function normalizeActivityLastDate(raw: unknown): string | null {
  if (typeof raw === "string") return normalizeYmdKey(raw);
  return null;
}

export function parseActivityLog(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizeYmdKey(k);
    if (!key) continue;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[key] = Math.floor(v);
  }
  return out;
}

export function bumpActivityLog(log: Record<string, number>, delta = 1, now = new Date()): Record<string, number> {
  const key = todayKeyJapan(now);
  return { ...log, [key]: (log[key] ?? 0) + delta };
}

/** activity_log の連続日数（東京暦）。今日未記録なら昨日から遡る */
export function streakFromActivityLog(log: Record<string, number>, now = new Date()): number {
  const today = todayKeyJapan(now);
  let cursor = (log[today] ?? 0) > 0 ? today : addDaysYmdJapan(today, -1);
  let streak = 0;
  while ((log[cursor] ?? 0) > 0) {
    streak += 1;
    cursor = addDaysYmdJapan(cursor, -1);
  }
  return streak;
}

/**
 * ストリーク更新パッチ。
 * activity_log を正とし、last_date 欠損や古いカウンタでも連続日が正しく伸びる。
 */
export function computeUserStreakPatch(prev: UserActivityState, now = new Date()): Partial<UserActivityState> {
  const today = todayKeyJapan(now);
  const log = prev.activityLog;
  const hasToday = (log[today] ?? 0) > 0;
  const nextStreak = streakFromActivityLog(log, now);
  const lastRaw = normalizeYmdKey(prev.activityLastDate);

  // 今日まだログが無い呼び出し（通常は bump 後に呼ぶ）向けのフォールバック
  if (!hasToday) {
    if (!lastRaw) {
      return { activityLastDate: today, activityStreak: 1 };
    }
    if (lastRaw === today) return {};
    const [ty, tm, td] = today.split("-").map(Number);
    const [ly, lm, ld] = lastRaw.split("-").map(Number);
    const diffDays = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ly, lm - 1, ld)) / 86400000);
    if (diffDays === 1) {
      return { activityLastDate: today, activityStreak: Math.max(1, Math.floor(prev.activityStreak) + 1) };
    }
    return { activityLastDate: today, activityStreak: 1 };
  }

  if (lastRaw === today && nextStreak === prev.activityStreak) return {};

  return {
    activityLastDate: today,
    activityStreak: Math.max(1, nextStreak),
  };
}
