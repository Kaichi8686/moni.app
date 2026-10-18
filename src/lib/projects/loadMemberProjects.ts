import { supabase } from "@/lib/supabase";

export type MemberProjectLite = {
  id: string;
  name: string;
  icon: string | null;
  thumbnail_url: string | null;
  updated_at: string;
};

const SELECT = "id,name,icon,thumbnail_url,updated_at,owner_id";

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** ログイン中ユーザーが参加／所有するプロジェクトを更新日順で返す */
export async function loadMemberProjects(uid: string): Promise<MemberProjectLite[]> {
  const client = supabase;
  if (!client) return [];

  const { data: mems } = await client.from("project_members").select("project_id").eq("user_id", uid);
  const memberIds = [...new Set((mems ?? []).map((m: { project_id: string }) => m.project_id))];

  let memberRows: MemberProjectLite[] = [];
  if (memberIds.length) {
    for (const batch of chunkIds(memberIds, 90)) {
      const res = await client.from("projects").select(SELECT).in("id", batch);
      if (!res.error) {
        memberRows = memberRows.concat((res.data ?? []) as MemberProjectLite[]);
      }
    }
  }

  const { data: owned } = await client
    .from("projects")
    .select(SELECT)
    .eq("owner_id", uid)
    .order("updated_at", { ascending: false })
    .limit(120);

  const byId = new Map<string, MemberProjectLite>();
  for (const row of [...memberRows, ...((owned ?? []) as MemberProjectLite[])]) {
    byId.set(row.id, row);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}
