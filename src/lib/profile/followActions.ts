import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasPendingFollowRequest,
  isFollowingUser,
  loadFollowList,
} from "@/lib/profile/profileData";
import type { FollowListUser } from "@/lib/profile/types";

export type FollowRelationState = "following" | "pending" | "none";

export type FollowActionResult =
  | { ok: true; state: FollowRelationState }
  | { ok: false; error: string; code?: string };

export type FollowBackResult = { ok: true } | { ok: false; error: string; code?: string };

async function isPrivateProfile(client: SupabaseClient, targetId: string): Promise<boolean> {
  const { data, error } = await client.from("profiles").select("is_private").eq("id", targetId).maybeSingle();
  if (error) {
    // Column may not exist yet on older DBs — treat as public (direct follow).
    if (error.code === "42703" || /does not exist/i.test(error.message)) return false;
    return false;
  }
  return Boolean((data as { is_private?: boolean } | null)?.is_private);
}

async function sendOrReopenFollowRequest(
  client: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<FollowActionResult> {
  const { error } = await client.from("follow_requests").insert({
    follower_id: viewerId,
    following_id: targetId,
    status: "pending",
  });

  if (!error) return { ok: true, state: "pending" };

  if (error.code === "42P01" || error.code === "PGRST205") {
    return {
      ok: false,
      error: "フォローリクエスト機能を有効化中です。少し待って再試行してください。",
      code: error.code,
    };
  }

  // Unique (follower_id, following_id): prior accepted/rejected row blocks insert.
  if (error.code === "23505") {
    const { error: updateError } = await client
      .from("follow_requests")
      .update({ status: "pending", resolved_at: null })
      .eq("follower_id", viewerId)
      .eq("following_id", targetId);

    if (!updateError) return { ok: true, state: "pending" };

    // Fallback: if already pending, treat as success.
    const pending = await hasPendingFollowRequest(client, viewerId, targetId);
    if (pending) return { ok: true, state: "pending" };

    return {
      ok: false,
      error: updateError.message || "フォローリクエストの再送に失敗しました。",
      code: updateError.code,
    };
  }

  return { ok: false, error: error.message, code: error.code };
}

/**
 * Toggle follow / follow-request between viewer and target.
 * Public profiles follow immediately; private profiles use requests.
 */
export async function toggleFollowRelation(
  client: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<FollowActionResult> {
  if (!viewerId || !targetId || viewerId === targetId) {
    return { ok: false, error: "無効なユーザーです。" };
  }

  const following = await isFollowingUser(client, viewerId, targetId);
  if (following) {
    const { error } = await client
      .from("follows")
      .delete()
      .eq("follower_id", viewerId)
      .eq("following_id", targetId);
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, state: "none" };
  }

  const pending = await hasPendingFollowRequest(client, viewerId, targetId);
  if (pending) {
    const { error } = await client
      .from("follow_requests")
      .delete()
      .eq("follower_id", viewerId)
      .eq("following_id", targetId)
      .eq("status", "pending");
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, state: "none" };
  }

  const privateProfile = await isPrivateProfile(client, targetId);
  if (privateProfile) {
    return sendOrReopenFollowRequest(client, viewerId, targetId);
  }

  const { error } = await client.from("follows").insert({
    follower_id: viewerId,
    following_id: targetId,
  });

  if (!error || error.code === "23505") {
    return { ok: true, state: "following" };
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return {
      ok: false,
      error: "フォロー機能を有効化中です。少し待って再試行してください。",
      code: error.code,
    };
  }

  return { ok: false, error: error.message, code: error.code };
}

/** True when both users follow each other. */
export async function areMutualFollowers(
  client: SupabaseClient,
  userA: string,
  userB: string,
): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false;
  const [aFollowsB, bFollowsA] = await Promise.all([
    isFollowingUser(client, userA, userB),
    isFollowingUser(client, userB, userA),
  ]);
  return aFollowsB && bFollowsA;
}

/** People the viewer follows who also follow the viewer (for Mail new-DM list). */
export async function loadMutualFollowList(
  client: SupabaseClient,
  viewerId: string,
): Promise<FollowListUser[]> {
  const following = await loadFollowList(client, viewerId, "following", viewerId);
  if (following.length === 0) return [];

  const ids = following.map((u) => u.id);
  const { data } = await client
    .from("follows")
    .select("follower_id")
    .eq("following_id", viewerId)
    .in("follower_id", ids);

  const mutualIds = new Set(
    ((data ?? []) as Array<{ follower_id: string }>).map((r) => r.follower_id),
  );
  return following.filter((u) => mutualIds.has(u.id));
}

/**
 * Follow-back from a notification:
 * - Accept pending request (them → you) when present
 * - Follow them (you → them) so the relationship becomes mutual when their account is public
 */
export async function followBackUser(
  client: SupabaseClient,
  viewerId: string,
  actorId: string,
  requestId?: string | null,
): Promise<FollowBackResult> {
  if (!viewerId || !actorId || viewerId === actorId) {
    return { ok: false, error: "無効なユーザーです。" };
  }

  let resolvedRequestId = requestId ?? null;
  if (!resolvedRequestId) {
    const { data } = await client
      .from("follow_requests")
      .select("id")
      .eq("follower_id", actorId)
      .eq("following_id", viewerId)
      .eq("status", "pending")
      .maybeSingle();
    resolvedRequestId = (data as { id?: string } | null)?.id ?? null;
  }

  if (resolvedRequestId) {
    const { error: insertError } = await client.from("follows").insert({
      follower_id: actorId,
      following_id: viewerId,
    });
    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: insertError.message, code: insertError.code };
    }

    const { error: updateError } = await client
      .from("follow_requests")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", resolvedRequestId)
      .eq("following_id", viewerId);
    if (updateError) {
      return { ok: false, error: updateError.message, code: updateError.code };
    }
  }

  const alreadyFollowing = await isFollowingUser(client, viewerId, actorId);
  if (alreadyFollowing) return { ok: true };

  const privateProfile = await isPrivateProfile(client, actorId);
  if (privateProfile) {
    const requestResult = await sendOrReopenFollowRequest(client, viewerId, actorId);
    if (!requestResult.ok) {
      return { ok: false, error: requestResult.error, code: requestResult.code };
    }
    return { ok: true };
  }

  const { error } = await client.from("follows").insert({
    follower_id: viewerId,
    following_id: actorId,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}

export async function rejectIncomingFollowRequest(
  client: SupabaseClient,
  viewerId: string,
  requestId: string,
): Promise<FollowBackResult> {
  const { error } = await client
    .from("follow_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("following_id", viewerId);
  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true };
}
