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

  const counts = await Promise.all(
    memberships.map(async (m) => {
      const lastRead = (m.last_read_at as string | null) ?? "1970-01-01T00:00:00.000Z";
      const { count, error: countErr } = await client
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", m.conversation_id as string)
        .gt("created_at", lastRead)
        .neq("sender_id", userId)
        .eq("is_deleted", false);
      if (countErr) return 0;
      return count ?? 0;
    }),
  );

  return counts.reduce((sum, n) => sum + n, 0);
}
