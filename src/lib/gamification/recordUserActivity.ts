import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileBadges, syncUserBadges } from "@/lib/gamification/syncBadges";
import {
  bumpActivityLog,
  computeUserStreakPatch,
  parseActivityLog,
  type UserActivityState,
} from "@/lib/gamification/userActivityStreak";

export type RecordActivityResult = {
  streak: number;
  streakChanged: boolean;
  newBadges: string[];
} | null;

const PROFILE_GAMIFICATION_SELECTS = [
  "id,activity_streak,activity_last_date,activity_log,badges",
  "id,activity_streak,activity_last_date,activity_log",
  "id",
];

async function fetchGamificationRow(client: SupabaseClient, userId: string) {
  for (const sel of PROFILE_GAMIFICATION_SELECTS) {
    const res = await client.from("profiles").select(sel).eq("id", userId).maybeSingle();
    if (!res.error && res.data) return res.data as unknown as Record<string, unknown>;
    const missing = res.error?.code === "42703" || /does not exist/i.test(res.error?.message ?? "");
    if (!missing) break;
  }
  return null;
}

/** 投稿・コメント・マイルストーン記録などで1日1回ストリークを進める */
export async function recordUserActivity(
  client: SupabaseClient,
  userId: string,
  points = 1,
): Promise<RecordActivityResult> {
  const row = await fetchGamificationRow(client, userId);
  if (!row) return null;

  if (!("activity_log" in row)) return null;

  const prev: UserActivityState = {
    activityStreak:
      typeof row.activity_streak === "number" && Number.isFinite(row.activity_streak)
        ? Math.floor(row.activity_streak)
        : 0,
    activityLastDate: typeof row.activity_last_date === "string" ? row.activity_last_date : null,
    activityLog: parseActivityLog(row.activity_log),
  };

  const prevBadgeIds = new Set(parseProfileBadges(row.badges).map((b) => b.id));
  const nextLog = bumpActivityLog(prev.activityLog, points);
  const streakPatch = computeUserStreakPatch(prev);
  const nextStreak =
    typeof streakPatch.activityStreak === "number" ? streakPatch.activityStreak : prev.activityStreak;

  const update: Record<string, unknown> = {
    activity_log: nextLog,
  };
  if (typeof streakPatch.activityStreak === "number") {
    update.activity_streak = streakPatch.activityStreak;
  }
  if (typeof streakPatch.activityLastDate === "string") {
    update.activity_last_date = streakPatch.activityLastDate;
  }

  const { error } = await client.from("profiles").update(update).eq("id", userId);
  if (error) {
    if (error.code === "42703") return null;
    throw new Error(error.message);
  }

  let mergedBadges = parseProfileBadges(row.badges);
  try {
    mergedBadges = await syncUserBadges(client, userId, nextStreak, mergedBadges);
  } catch {
    /* badges column may be missing */
  }

  const newBadges = mergedBadges.filter((b) => !prevBadgeIds.has(b.id)).map((b) => b.id);

  return {
    streak: nextStreak,
    streakChanged: Object.keys(streakPatch).length > 0,
    newBadges,
  };
}
