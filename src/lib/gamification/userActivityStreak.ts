import { todayKeyJapan } from "@/lib/projects/teamActivityStreak";

export type UserActivityState = {
  activityStreak: number;
  activityLastDate: string | null;
  activityLog: Record<string, number>;
};

export function parseActivityLog(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
  }
  return out;
}

export function bumpActivityLog(log: Record<string, number>, delta = 1): Record<string, number> {
  const key = todayKeyJapan();
  return { ...log, [key]: (log[key] ?? 0) + delta };
}

export function computeUserStreakPatch(prev: UserActivityState): Partial<UserActivityState> {
  const today = todayKeyJapan();
  const lastRaw = prev.activityLastDate?.trim();
  const cur =
    typeof prev.activityStreak === "number" && Number.isFinite(prev.activityStreak) && prev.activityStreak >= 0
      ? Math.floor(prev.activityStreak)
      : 0;

  if (!lastRaw || !/^\d{4}-\d{2}-\d{2}$/.test(lastRaw)) {
    return { activityLastDate: today, activityStreak: 1 };
  }
  if (lastRaw === today) return {};

  const [ty, tm, td] = today.split("-").map(Number);
  const [ly, lm, ld] = lastRaw.split("-").map(Number);
  const diffDays = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ly, lm - 1, ld)) / 86400000);

  if (diffDays === 1) return { activityLastDate: today, activityStreak: cur + 1 };
  return { activityLastDate: today, activityStreak: 1 };
}
