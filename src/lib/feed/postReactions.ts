import type { SupabaseClient } from "@supabase/supabase-js";

export type ReactionKind = "fire" | "idea" | "help";

export const REACTION_META: Record<ReactionKind, { emoji: string; label: string }> = {
  fire: { emoji: "🔥", label: "すごい" },
  idea: { emoji: "💡", label: "参考" },
  help: { emoji: "🤝", label: "手伝いたい" },
};

export type PostReactionCounts = Record<ReactionKind, number>;

export function emptyReactionCounts(): PostReactionCounts {
  return { fire: 0, idea: 0, help: 0 };
}

export async function loadPostReactionMaps(
  client: SupabaseClient,
  postIds: string[],
  viewerId: string | null,
): Promise<{ counts: Map<string, PostReactionCounts>; mine: Map<string, ReactionKind> }> {
  const counts = new Map<string, PostReactionCounts>();
  const mine = new Map<string, ReactionKind>();
  if (!postIds.length) return { counts, mine };

  for (const id of postIds) counts.set(id, emptyReactionCounts());

  const { data, error } = await client
    .from("post_reactions")
    .select("post_id,reaction,user_id")
    .in("post_id", postIds);

  if (error) {
    if (error.code === "42P01") return { counts, mine };
    return { counts, mine };
  }

  for (const row of data ?? []) {
    const pid = row.post_id as string;
    const r = row.reaction as ReactionKind;
    if (r !== "fire" && r !== "idea" && r !== "help") continue;
    const c = counts.get(pid) ?? emptyReactionCounts();
    c[r] += 1;
    counts.set(pid, c);
    if (viewerId && row.user_id === viewerId) mine.set(pid, r);
  }
  return { counts, mine };
}

export async function togglePostReaction(
  client: SupabaseClient,
  userId: string,
  postId: string,
  reaction: ReactionKind,
  current: ReactionKind | null,
): Promise<ReactionKind | null> {
  if (current === reaction) {
    await client.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    return null;
  }
  await client.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
  const { error } = await client.from("post_reactions").insert({
    post_id: postId,
    user_id: userId,
    reaction,
  });
  if (error) throw new Error(error.message);
  return reaction;
}
