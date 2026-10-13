import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileBadges, syncUserBadges } from "@/lib/gamification/syncBadges";
import {
  bumpActivityLog,
  computeUserStreakPatch,
  normalizeActivityLastDate,
  parseActivityLog,
  streakFromActivityLog,
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
  "id,activity_streak,activity_log,badges",
  "id,activity_streak,activity_log",
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
    activityLastDate: normalizeActivityLastDate(row.activity_last_date),
    activityLog: parseActivityLog(row.activity_log),
  };

  const prevBadgeIds = new Set(parseProfileBadges(row.badges).map((b) => b.id));
  const nextLog = bumpActivityLog(prev.activityLog, points);
  const streakPatch = computeUserStreakPatch({ ...prev, activityLog: nextLog });
  const nextStreak =
    typeof streakPatch.activityStreak === "number"
      ? streakPatch.activityStreak
      : Math.max(prev.activityStreak, streakFromActivityLog(nextLog));

  const update: Record<string, unknown> = {
    activity_log: nextLog,
    activity_streak: nextStreak,
  };
  if (typeof streakPatch.activityLastDate === "string") {
    update.activity_last_date = streakPatch.activityLastDate;
  } else if (prev.activityLastDate) {
    update.activity_last_date = prev.activityLastDate;
  }

  const { error } = await client.from("profiles").update(update).eq("id", userId);
  if (error) {
    // activity_last_date が無い DB でも log + streak は進める
    if (error.code === "42703" && "activity_last_date" in update) {
      delete update.activity_last_date;
      const retry = await client.from("profiles").update(update).eq("id", userId);
      if (retry.error) {
        if (retry.error.code === "42703") return null;
        throw new Error(retry.error.message);
      }
    } else if (error.code === "42703") {
      return null;
    } else {
      throw new Error(error.message);
    }
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
    streakChanged: nextStreak !== prev.activityStreak || Object.keys(streakPatch).length > 0,
    newBadges,
  };
}
