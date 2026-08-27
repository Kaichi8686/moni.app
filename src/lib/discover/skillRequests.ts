import type { SupabaseClient } from "@supabase/supabase-js";

export const SKILL_OPTIONS = [
  "デザイナー",
  "エンジニア",
  "営業",
  "マーケ",
  "動画編集",
  "財務・会計",
  "法律相談",
  "SNS運用",
  "写真撮影",
  "通訳",
] as const;

export type SkillRequest = {
  id: string;
  requesterId: string;
  requesterName: string;
  projectId: string | null;
  skillName: string;
  description: string | null;
  duration: string;
  compensation: string;
  status: string;
  createdAt: string;
};

export async function loadOpenSkillRequests(client: SupabaseClient, limit = 30): Promise<SkillRequest[]> {
  const { data, error } = await client
    .from("skill_requests")
    .select("id,requester_id,project_id,skill_name,description,duration,compensation,status,created_at,profiles:requester_id(display_name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const prof = r.profiles as unknown;
    const p = (Array.isArray(prof) ? prof[0] : prof) as { display_name?: string } | null;
    return {
      id: r.id as string,
      requesterId: r.requester_id as string,
      requesterName: (p?.display_name as string)?.trim() || "ユーザー",
      projectId: (r.project_id as string | null) ?? null,
      skillName: r.skill_name as string,
      description: (r.description as string | null) ?? null,
      duration: r.duration as string,
      compensation: r.compensation as string,
      status: r.status as string,
      createdAt: r.created_at as string,
    };
  });
}

export async function createSkillRequest(
  client: SupabaseClient,
  userId: string,
  input: {
    skillName: string;
    description?: string;
    projectId?: string | null;
    duration: string;
    compensation: string;
  },
) {
  const { error } = await client.from("skill_requests").insert({
    requester_id: userId,
    project_id: input.projectId ?? null,
    skill_name: input.skillName,
    description: input.description?.trim() || null,
    duration: input.duration,
    compensation: input.compensation,
  });
  if (error) throw new Error(error.message);
}
