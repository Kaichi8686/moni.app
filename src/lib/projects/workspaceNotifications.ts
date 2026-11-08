import type { SupabaseClient } from "@supabase/supabase-js";

/** プロジェクトワークスペース（メインタブ）向けのお知らせ種別 */
export const WORKSPACE_NOTIFICATION_TYPES = [
  "vote_started",
  "vote_ended",
  "member_added",
  "recruitment_applied",
  "issue_submitted",
  "roadmap_achieved",
] as const;

export type WorkspaceNotificationType = (typeof WORKSPACE_NOTIFICATION_TYPES)[number];

export type WorkspaceNotificationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const WORKSPACE_TYPE_SET = new Set<string>(WORKSPACE_NOTIFICATION_TYPES);

export function isWorkspaceNotificationType(type: string): boolean {
  return WORKSPACE_TYPE_SET.has(type);
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("project_notify_members")
  );
}

/** メンバー（または応募者）向けにプロジェクト内お知らせを配信。RPC 未適用時は黙ってスキップ */
export async function notifyProjectMembers(
  client: SupabaseClient,
  input: {
    projectId: string;
    type: WorkspaceNotificationType;
    body: string;
    excludeUserId?: string | null;
    roles?: Array<"owner" | "admin" | "member"> | null;
  },
): Promise<void> {
  const body = input.body.trim().slice(0, 500);
  if (!input.projectId || !body) return;
  const { error } = await client.rpc("project_notify_members", {
    p_project_id: input.projectId,
    p_type: input.type,
    p_body: body,
    p_exclude_user_id: input.excludeUserId ?? null,
    p_roles: input.roles ?? null,
  });
  if (error && !isMissingRelation(error)) {
    console.warn("project_notify_members:", error.message);
  }
}

export async function fetchWorkspaceNotifications(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  limit = 40,
): Promise<WorkspaceNotificationRow[]> {
  const { data, error } = await client
    .from("project_notifications")
    .select("id,user_id,project_id,type,body,read_at,created_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 2, 40));

  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return ((data ?? []) as WorkspaceNotificationRow[])
    .filter((row) => isWorkspaceNotificationType(row.type))
    .slice(0, limit);
}

export async function countUnreadWorkspaceNotifications(
  client: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<number> {
  const { data, error } = await client
    .from("project_notifications")
    .select("id,type")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .is("read_at", null)
    .limit(80);

  if (error) {
    if (isMissingRelation(error)) return 0;
    throw error;
  }
  return ((data ?? []) as Array<{ id: string; type: string }>).filter((row) =>
    isWorkspaceNotificationType(row.type),
  ).length;
}

/** 参加プロジェクトのうち、未読のワークスペース通知がある project_id の集合 */
export async function fetchUnreadWorkspaceProjectIds(
  client: SupabaseClient,
  userId: string,
  excludeProjectId?: string | null,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("project_notifications")
    .select("project_id,type")
    .eq("user_id", userId)
    .is("read_at", null)
    .not("project_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingRelation(error)) return new Set();
    throw error;
  }

  const out = new Set<string>();
  for (const row of data ?? []) {
    const projectId = row.project_id as string | null;
    const type = row.type as string;
    if (!projectId || !isWorkspaceNotificationType(type)) continue;
    if (excludeProjectId && projectId === excludeProjectId) continue;
    out.add(projectId);
  }
  return out;
}

export async function markWorkspaceNotificationsRead(
  client: SupabaseClient,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;
  const { error } = await client
    .from("project_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", notificationIds)
    .is("read_at", null);
  if (error && !isMissingRelation(error)) {
    throw error;
  }
}

export function formatWorkspaceNotificationBody(type: string, body: string): string {
  const trimmed = body.trim();
  if (trimmed) return trimmed;
  switch (type) {
    case "vote_started":
      return "投票が始まりました。";
    case "vote_ended":
      return "投票が終了しました。";
    case "member_added":
      return "新しいメンバーが追加されました。";
    case "recruitment_applied":
      return "プロジェクトの募集に応募がありました。";
    case "issue_submitted":
      return "課題が提出されました。";
    case "roadmap_achieved":
      return "ロードマップが達成されました。";
    default:
      return "新しいお知らせがあります。";
  }
}

export function workspaceNotificationHref(
  projectId: string,
  type: string,
): string {
  switch (type) {
    case "vote_started":
    case "vote_ended":
      return `/projects/${projectId}/ideas`;
    case "member_added":
    case "recruitment_applied":
      return `/projects/${projectId}/members`;
    case "issue_submitted":
      return `/projects/${projectId}/issues`;
    case "roadmap_achieved":
      return `/projects/${projectId}/overview`;
    default:
      return `/projects/${projectId}/overview`;
  }
}
