import type { SupabaseClient } from "@supabase/supabase-js";
import type { EarnedBadge } from "@/lib/gamification/badges";
import { parseProfileBadges } from "@/lib/gamification/syncBadges";
import { parseActivityLog } from "@/lib/gamification/userActivityStreak";

export type ProfileGamification = {
  activityStreak: number;
  activityLog: Record<string, number>;
  badges: EarnedBadge[];
  gamificationReady: boolean;
};

const SELECTS = [
  "id,activity_streak,activity_last_date,activity_log,badges",
  "id,activity_streak,activity_log,badges",
  "id",
];

export async function loadProfileGamification(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileGamification> {
  for (const sel of SELECTS) {
    const res = await client.from("profiles").select(sel).eq("id", userId).maybeSingle();
    if (!res.error && res.data) {
      const row = res.data as unknown as Record<string, unknown>;
      const ready = "activity_log" in row;
      return {
        gamificationReady: ready,
        activityStreak:
          ready && typeof row.activity_streak === "number" ? Math.max(0, Math.floor(row.activity_streak)) : 0,
        activityLog: ready ? parseActivityLog(row.activity_log) : {},
        badges: ready ? parseProfileBadges(row.badges) : [],
      };
    }
    const missing = res.error?.code === "42703" || /does not exist/i.test(res.error?.message ?? "");
    if (!missing) break;
  }
  return { activityStreak: 0, activityLog: {}, badges: [], gamificationReady: false };
}
