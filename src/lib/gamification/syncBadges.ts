import type { SupabaseClient } from "@supabase/supabase-js";
import { badgesToGrant, mergeEarnedBadges, type EarnedBadge } from "@/lib/gamification/badges";

function parseBadges(raw: unknown): EarnedBadge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is EarnedBadge => Boolean(b && typeof b === "object" && typeof (b as EarnedBadge).id === "string"))
    .map((b) => ({ id: b.id, earned_at: typeof b.earned_at === "string" ? b.earned_at : new Date().toISOString() }));
}

export async function gatherBadgeStats(client: SupabaseClient, userId: string, activityStreak: number) {
  const [{ count: postCount }, { count: pitchCount }, memberRes, milestoneRes, ownedRes] = await Promise.all([
    client.from("posts").select("*", { count: "exact", head: true }).eq("author_id", userId),
    client.from("pitches").select("*", { count: "exact", head: true }).eq("author_id", userId),
    client.from("project_members").select("project_id").eq("user_id", userId),
    client.from("milestones").select("type").eq("user_id", userId),
    client.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);

  const teamProjectCount = new Set((memberRes.data ?? []).map((r) => r.project_id as string)).size;
  const projectCount = Math.max(ownedRes.count ?? 0, teamProjectCount > 0 ? 1 : 0);
  const milestoneTypes = new Set((milestoneRes.data ?? []).map((m) => m.type as string));

  return {
    postCount: postCount ?? 0,
    projectCount: projectCount >= 1 ? projectCount : teamProjectCount >= 1 ? 1 : 0,
    teamProjectCount,
    pitchCount: pitchCount ?? 0,
    activityStreak,
    milestoneTypes,
  };
}

export async function syncUserBadges(
  client: SupabaseClient,
  userId: string,
  activityStreak: number,
  currentBadges: EarnedBadge[],
): Promise<EarnedBadge[]> {
  const stats = await gatherBadgeStats(client, userId, activityStreak);
  const toAdd = badgesToGrant(stats);
  const merged = mergeEarnedBadges(currentBadges, toAdd);
  if (merged.length === currentBadges.length) return currentBadges;

  const { error } = await client.from("profiles").update({ badges: merged }).eq("id", userId);
  if (error && error.code !== "42703") throw new Error(error.message);
  return merged;
}

export function parseProfileBadges(raw: unknown): EarnedBadge[] {
  return parseBadges(raw);
}
