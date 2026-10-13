import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPendingFollowRequest, isFollowingUser } from "@/lib/profile/profileData";

export type FollowRelationState = "following" | "pending" | "none";

export type FollowActionResult =
  | { ok: true; state: FollowRelationState }
  | { ok: false; error: string; code?: string };

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
