import { supabase } from "@/lib/supabase";

export type ProjectInviteRow = {
  id: string;
  project_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string;
  created_at: string;
  resolved_at: string | null;
  project_name?: string;
};

export type ProjectNotificationRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ProfileSearchHit = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type InvitePayload = {
  v?: number;
  status?: string;
  inviterId?: string;
  projectName?: string;
  message?: string;
};

function parseInvitePayload(body: string): InvitePayload | null {
  try {
    const parsed = JSON.parse(body) as InvitePayload;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return null;
  }
  return null;
}

async function authHeader(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

export async function fetchIncomingProjectInvites(userId: string): Promise<ProjectInviteRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("project_notifications")
    .select("id,user_id,project_id,type,body,created_at")
    .eq("user_id", userId)
    .eq("type", "project_invite")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.error("fetchIncomingProjectInvites", error);
    return [];
  }

  const out: ProjectInviteRow[] = [];
  for (const row of data ?? []) {
    const payload = parseInvitePayload(row.body as string);
    if (!payload || payload.status !== "pending") continue;
    out.push({
      id: row.id as string,
      project_id: (row.project_id as string) || "",
      inviter_id: payload.inviterId || "",
      invitee_id: userId,
      status: "pending",
      message: payload.message || "",
      created_at: row.created_at as string,
      resolved_at: null,
      project_name: payload.projectName,
    });
  }
  return out;
}

export async function fetchMyProjectNotifications(userId: string, limit = 30): Promise<ProjectNotificationRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("project_notifications")
    .select("id,user_id,project_id,type,body,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchMyProjectNotifications", error);
    return [];
  }
  return (data ?? []) as ProjectNotificationRow[];
}

export async function markProjectNotificationsRead(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase
    .from("project_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
}

export async function sendProjectInvite(
  projectId: string,
  inviteeId: string,
  message = "",
): Promise<{ ok: true; invite: ProjectInviteRow } | { ok: false; error: string }> {
  const auth = await authHeader();
  if (!auth) return { ok: false, error: "ログインが必要です" };
  const res = await fetch("/api/projects/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ projectId, inviteeId, message }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; invite?: ProjectInviteRow; error?: string };
  if (!res.ok || !json.ok || !json.invite) {
    return { ok: false, error: json.error || "招待に失敗しました" };
  }
  return { ok: true, invite: json.invite };
}

export async function respondProjectInvite(
  inviteId: string,
  action: "accept" | "decline",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authHeader();
  if (!auth) return { ok: false, error: "ログインが必要です" };
  const res = await fetch("/api/projects/invite/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ inviteId, action }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || "処理に失敗しました" };
  }
  return { ok: true };
}

export async function searchProfilesForInvite(
  query: string,
  excludeIds: string[],
): Promise<ProfileSearchHit[]> {
  const auth = await authHeader();
  if (!auth) return [];
  const q = query.trim();
  if (q.length < 1) return [];
  const res = await fetch(`/api/projects/invite/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { users?: ProfileSearchHit[] };
  const exclude = new Set(excludeIds);
  return (json.users ?? []).filter((p) => !exclude.has(p.id));
}

/** 通知本文をUI表示用に整形 */
export function formatNotificationBody(type: string, body: string): string {
  if (type === "project_invite") {
    const payload = parseInvitePayload(body);
    if (payload?.projectName) return `「${payload.projectName}」への招待が届きました。`;
    if (payload?.status === "accepted") return "招待を承認しました。";
    if (payload?.status === "declined") return "招待を辞退しました。";
  }
  if (body.trim().startsWith("{")) {
    const payload = parseInvitePayload(body);
    if (payload?.projectName && payload.status === "accepted") {
      return `「${payload.projectName}」への招待を承認しました。`;
    }
    if (payload?.projectName && payload.status === "declined") {
      return `「${payload.projectName}」への招待を辞退しました。`;
    }
  }
  return body;
}
