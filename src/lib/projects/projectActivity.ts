import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectActivityKind = "task_done" | "issue_done" | "comment" | "phase" | "member";

export async function logProjectActivity(
  client: SupabaseClient,
  input: { projectId: string; userId: string; kind: ProjectActivityKind; body: string },
) {
  const { error } = await client.from("project_activity_events").insert({
    project_id: input.projectId,
    user_id: input.userId,
    kind: input.kind,
    body: input.body.slice(0, 500),
  });
  if (error && error.code !== "42P01") {
    console.warn("project_activity_events:", error.message);
  }
}

export async function resolveActivityDisplayName(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await client.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const name = (data?.display_name as string | null | undefined)?.trim();
  return name || "ユーザー";
}

/** メンバー参加（招待承諾・申請承認など） */
export async function logMemberJoinedActivity(
  client: SupabaseClient,
  input: {
    projectId: string;
    /** RLS: auth.uid() と一致させる（承認者または本人） */
    actorUserId: string;
    memberUserId: string;
    memberName?: string;
  },
) {
  const name =
    input.memberName?.trim() || (await resolveActivityDisplayName(client, input.memberUserId));
  await logProjectActivity(client, {
    projectId: input.projectId,
    userId: input.actorUserId,
    kind: "member",
    body: `${name}さんが参加しました`,
  });
}

/** ロードマップ（フェーズ）達成 */
export async function logRoadmapPhaseAchievedActivity(
  client: SupabaseClient,
  input: { projectId: string; userId: string; phaseTitle: string },
) {
  const title = input.phaseTitle.trim() || "ロードマップ";
  await logProjectActivity(client, {
    projectId: input.projectId,
    userId: input.userId,
    kind: "phase",
    body: `ロードマップ「${title}」を達成しました`,
  });
}

export type ProjectActivityEvent = {
  id: string;
  userId: string | null;
  kind: ProjectActivityKind;
  body: string;
  createdAt: string;
};

export async function loadProjectActivity(
  client: SupabaseClient,
  projectId: string,
  limit = 20,
): Promise<ProjectActivityEvent[]> {
  const { data, error } = await client
    .from("project_activity_events")
    .select("id,user_id,kind,body,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    userId: (r.user_id as string | null) ?? null,
    kind: r.kind as ProjectActivityKind,
    body: r.body as string,
    createdAt: r.created_at as string,
  }));
}
