import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectNotificationType =
  | "join_request_received"
  | "join_request_accepted"
  | "join_request_rejected"
  | "project_invited"
  | "project_invite"
  | "project_invite_accepted"
  | "project_invite_declined"
  | "project_invite_resolved";

/** 自分宛の結果・招待だけ。他人の行動（参加申請が届いた / 相手が承認した等）は出さない */
const SELF_PROJECT_NOTIFICATION_TYPES = new Set<string>([
  "project_invite",
  "project_invite_resolved",
  "project_invited",
  "join_request_accepted",
  "join_request_rejected",
]);

export type ProjectNotificationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function isSelfProjectNotification(type: string): boolean {
  return SELF_PROJECT_NOTIFICATION_TYPES.has(type);
}

export function projectNotificationHref(row: Pick<ProjectNotificationRow, "type" | "project_id">): string | null {
  if (!row.project_id) return null;
  if (row.type === "project_invite") {
    return `/projects`;
  }
  return `/projects/${row.project_id}/overview`;
}

export async function fetchUnreadProjectNotifications(
  client: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<ProjectNotificationRow[]> {
  const { data, error } = await client
    .from("project_notifications")
    .select("id,user_id,project_id,type,body,read_at,created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 40));

  if (error) {
    // テーブル未適用時は空で継続
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return ((data ?? []) as ProjectNotificationRow[])
    .filter((row) => isSelfProjectNotification(row.type))
    .slice(0, limit);
}

export async function markProjectNotificationRead(
  client: SupabaseClient,
  notificationId: string,
): Promise<void> {
  await markProjectNotificationsRead(client, [notificationId]);
}

export async function markProjectNotificationsRead(
  client: SupabaseClient,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;
  const { error } = await client
    .from("project_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", notificationIds)
    .is("read_at", null);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw error;
  }
}
