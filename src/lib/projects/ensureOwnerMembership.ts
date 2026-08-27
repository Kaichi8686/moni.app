import { supabase } from "@/lib/supabase";

/** オーナーが project_members にいない場合に自己修復（一覧から消える対策） */
export async function ensureOwnerMembership(projectId: string, ownerId: string): Promise<void> {
  if (!supabase) return;
  const client = supabase;
  const { data: session } = await client.auth.getUser();
  const uid = session.user?.id;
  if (!uid || uid !== ownerId) return;
  const { data: existing } = await client
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", uid)
    .maybeSingle();
  if (existing) return;
  await client.from("project_members").insert({ project_id: projectId, user_id: uid, role: "owner" });
}
