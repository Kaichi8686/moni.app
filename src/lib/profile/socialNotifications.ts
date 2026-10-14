import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { supabase } from "@/lib/supabase";

export type FollowNoticeKind = "follow" | "follow_request";

/** Actionable follow notices shown in the 通知 panel. */
export type FollowNoticeItem = {
  id: string;
  kind: FollowNoticeKind;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  actorGoal: string;
  createdAt: string;
  /** Pending follow_request id when kind is follow_request */
  requestId: string | null;
  isFollowingActor: boolean;
};

const ONE_WAY_FOLLOW_WINDOW_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

/**
 * Build follow inbox from live follows + follow_requests.
 * - Pending requests (private accounts)
 * - Recent one-way followers (public follows you have not followed back)
 */
export async function fetchFollowNotices(
  client: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<FollowNoticeItem[]> {
  const [{ data: requestRows, error: requestError }, { data: followerRows, error: followerError }] =
    await Promise.all([
      client
        .from("follow_requests")
        .select("id,follower_id,created_at")
        .eq("following_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit),
      client
        .from("follows")
        .select("follower_id,created_at")
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

  if (requestError && !isMissingRelation(requestError)) {
    console.error("fetchFollowNotices requests", requestError);
  }
  if (followerError && !isMissingRelation(followerError)) {
    console.error("fetchFollowNotices followers", followerError);
  }

  const requests = (requestRows ?? []) as Array<{ id: string; follower_id: string; created_at: string }>;
  const followers = (followerRows ?? []) as Array<{ follower_id: string; created_at: string }>;
  const requestActorIds = new Set(requests.map((r) => r.follower_id));

  const cutoff = Date.now() - ONE_WAY_FOLLOW_WINDOW_MS;
  const oneWayCandidates = followers.filter((row) => {
    if (requestActorIds.has(row.follower_id)) return false;
    const t = new Date(row.created_at).getTime();
    return Number.isFinite(t) ? t >= cutoff : true;
  });

  const actorIds = [...new Set([...requests.map((r) => r.follower_id), ...oneWayCandidates.map((r) => r.follower_id)])];
  if (actorIds.length === 0) return [];

  const [{ data: profiles }, { data: followingRows }] = await Promise.all([
    client.from("profiles").select("id,display_name,goal,avatar_url").in("id", actorIds),
    client.from("follows").select("following_id").eq("follower_id", userId).in("following_id", actorIds),
  ]);

  const profileById = new Map(
    (
      (profiles ?? []) as Array<{
        id: string;
        display_name: string | null;
        goal: string | null;
        avatar_url: string | null;
      }>
    ).map((p) => [p.id, p]),
  );
  const followingSet = new Set(
    ((followingRows ?? []) as Array<{ following_id: string }>).map((r) => r.following_id),
  );

  const items: FollowNoticeItem[] = [];

  for (const row of requests) {
    const profile = profileById.get(row.follower_id);
    const actorName = (profile?.display_name || "ユーザー").trim() || "ユーザー";
    items.push({
      id: `request:${row.id}`,
      kind: "follow_request",
      actorId: row.follower_id,
      actorName,
      actorAvatarUrl: resolveMemberAvatarUrl(row.follower_id, profile?.avatar_url ?? null),
      actorGoal: (profile?.goal || "目標未設定").trim() || "目標未設定",
      createdAt: row.created_at,
      requestId: row.id,
      isFollowingActor: followingSet.has(row.follower_id),
    });
  }

  for (const row of oneWayCandidates) {
    if (followingSet.has(row.follower_id)) continue;
    const profile = profileById.get(row.follower_id);
    const actorName = (profile?.display_name || "ユーザー").trim() || "ユーザー";
    items.push({
      id: `follow:${row.follower_id}:${row.created_at}`,
      kind: "follow",
      actorId: row.follower_id,
      actorName,
      actorAvatarUrl: resolveMemberAvatarUrl(row.follower_id, profile?.avatar_url ?? null),
      actorGoal: (profile?.goal || "目標未設定").trim() || "目標未設定",
      createdAt: row.created_at,
      requestId: null,
      isFollowingActor: false,
    });
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function countActionableFollowNotices(
  client: SupabaseClient,
  userId: string,
): Promise<number> {
  const items = await fetchFollowNotices(client, userId, 40);
  return items.filter((n) => !n.isFollowingActor || n.kind === "follow_request").length;
}

export async function fetchFollowNoticesForCurrentUser(
  userId: string,
  limit = 40,
): Promise<FollowNoticeItem[]> {
  if (!supabase) return [];
  return fetchFollowNotices(supabase, userId, limit);
}
