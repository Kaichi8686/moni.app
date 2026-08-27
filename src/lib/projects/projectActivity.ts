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
