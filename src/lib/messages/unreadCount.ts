import type { SupabaseClient } from "@supabase/supabase-js";

/** 新メッセージ（conversations / messages）の未読合計 */
export async function fetchInboxUnreadCount(
  client: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: memberships, error } = await client
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return 0;
    console.error("fetchInboxUnreadCount", error);
    return 0;
  }
  if (!memberships?.length) return 0;

  const readMap = new Map(
    memberships.map((m) => [m.conversation_id as string, (m.last_read_at as string | null) ?? null]),
  );
  const convIds = [...readMap.keys()];

  // Prefer last_message_at so we skip count queries for already-read threads.
  const { data: convs } = await client
    .from("conversations")
    .select("id, last_message_at")
    .in("id", convIds);

  const candidates = (convs ?? [])
    .filter((c) => {
      const lastAt = c.last_message_at as string | null;
      if (!lastAt) return false;
      const lastRead = readMap.get(c.id as string);
      if (!lastRead) return true;
      return new Date(lastAt).getTime() > new Date(lastRead).getTime();
    })
    .map((c) => c.id as string);

  if (candidates.length === 0) return 0;

  let next = 0;
  const counts = new Array<number>(candidates.length).fill(0);
  const workers = Array.from({ length: Math.min(6, candidates.length) }, async () => {
    while (next < candidates.length) {
      const idx = next;
      next += 1;
      const cid = candidates[idx]!;
      const lastRead = readMap.get(cid) ?? "1970-01-01T00:00:00.000Z";
      const { count, error: countErr } = await client
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", cid)
        .gt("created_at", lastRead)
        .neq("sender_id", userId)
        .eq("is_deleted", false);
      counts[idx] = countErr ? 0 : (count ?? 0);
    }
  });
  await Promise.all(workers);

  return counts.reduce((sum, n) => sum + n, 0);
}
