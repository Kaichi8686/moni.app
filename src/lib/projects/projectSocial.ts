import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectRow } from "@/lib/projects/types";

export type ProjectSocialState = {
  likedByMe: boolean;
  favoritedByMe: boolean;
  likeCount: number;
};

export type ProjectWithSocial = ProjectRow &
  ProjectSocialState & {
    memberCount: number;
    ownerName?: string;
  };

function isSchemaMismatchError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("Could not find the table")
  );
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** like_count カラム未適用時でも動くようフォールバック付きで取得する */
export async function fetchPublicProjects(
  client: SupabaseClient,
  limit = 80,
): Promise<{ rows: ProjectRow[]; error: string | null; schemaMissingLikeCount: boolean }> {
  const selects = [
    "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,recruitment_target,recruitment_message,like_count,created_at,updated_at",
    "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at",
    "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,created_at,updated_at",
  ] as const;

  let schemaMissingLikeCount = false;
  for (let i = 0; i < selects.length; i += 1) {
    const select = selects[i]!;
    const res = await client
      .from("projects")
      .select(select)
      .eq("visibility", "public")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!res.error) {
      if (i > 0) schemaMissingLikeCount = !select.includes("like_count");
      return { rows: (res.data ?? []) as unknown as ProjectRow[], error: null, schemaMissingLikeCount };
    }
    if (!isSchemaMismatchError(res.error)) {
      return { rows: [], error: res.error.message, schemaMissingLikeCount };
    }
    if (select.includes("like_count")) schemaMissingLikeCount = true;
  }
  return { rows: [], error: "公開プロジェクトの取得に失敗しました。", schemaMissingLikeCount };
}

export async function fetchMemberCounts(
  client: SupabaseClient,
  projectIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (projectIds.length === 0) return counts;
  for (const batch of chunkIds(projectIds, 90)) {
    const { data, error } = await client.from("project_members").select("project_id").in("project_id", batch);
    if (error) continue;
    for (const row of data ?? []) {
      const id = row.project_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}

export async function fetchOwnerNames(
  client: SupabaseClient,
  ownerIds: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = [...new Set(ownerIds.filter(Boolean))];
  if (unique.length === 0) return map;
  for (const batch of chunkIds(unique, 90)) {
    const { data } = await client.from("profiles").select("id,display_name").in("id", batch);
    for (const p of data ?? []) {
      map[p.id as string] = ((p.display_name as string | null) ?? "").trim() || "オーナー";
    }
  }
  return map;
}

export async function fetchSocialForProjects(
  client: SupabaseClient,
  userId: string | null,
  projectIds: string[],
): Promise<{
  likedIds: Set<string>;
  favoritedIds: Set<string>;
  likeCounts: Record<string, number>;
  socialSchemaMissing: boolean;
}> {
  const likedIds = new Set<string>();
  const favoritedIds = new Set<string>();
  const likeCounts: Record<string, number> = {};
  if (projectIds.length === 0) {
    return { likedIds, favoritedIds, likeCounts, socialSchemaMissing: false };
  }

  let socialSchemaMissing = false;

  for (const batch of chunkIds(projectIds, 90)) {
    const likesRes = await client.from("project_likes").select("project_id,user_id").in("project_id", batch);
    if (likesRes.error) {
      if (isSchemaMismatchError(likesRes.error)) {
        socialSchemaMissing = true;
        break;
      }
    } else {
      for (const row of likesRes.data ?? []) {
        const pid = row.project_id as string;
        likeCounts[pid] = (likeCounts[pid] ?? 0) + 1;
        if (userId && row.user_id === userId) likedIds.add(pid);
      }
    }
  }

  if (!socialSchemaMissing && userId) {
    for (const batch of chunkIds(projectIds, 90)) {
      const favRes = await client
        .from("project_favorites")
        .select("project_id")
        .eq("user_id", userId)
        .in("project_id", batch);
      if (favRes.error) {
        if (isSchemaMismatchError(favRes.error)) {
          socialSchemaMissing = true;
          break;
        }
      } else {
        for (const row of favRes.data ?? []) {
          favoritedIds.add(row.project_id as string);
        }
      }
    }
  }

  return { likedIds, favoritedIds, likeCounts, socialSchemaMissing };
}

export async function fetchFavoriteProjectIds(
  client: SupabaseClient,
  userId: string,
): Promise<{ ids: string[]; schemaMissing: boolean }> {
  const { data, error } = await client
    .from("project_favorites")
    .select("project_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    if (isSchemaMismatchError(error)) return { ids: [], schemaMissing: true };
    return { ids: [], schemaMissing: false };
  }
  return { ids: (data ?? []).map((r) => r.project_id as string), schemaMissing: false };
}

export async function fetchWorkingOnProjectId(
  client: SupabaseClient,
  userId: string,
): Promise<{ projectId: string | null; schemaMissing: boolean }> {
  const { data, error } = await client
    .from("user_project_focus")
    .select("project_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isSchemaMismatchError(error)) return { projectId: null, schemaMissing: true };
    return { projectId: null, schemaMissing: false };
  }
  return { projectId: (data?.project_id as string | undefined) ?? null, schemaMissing: false };
}

export async function setWorkingOnProject(
  client: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<{ ok: boolean; error: string | null; schemaMissing?: boolean }> {
  const { error } = await client.from("user_project_focus").upsert(
    { user_id: userId, project_id: projectId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) {
    if (isSchemaMismatchError(error)) {
      return { ok: false, error: "取り組み中機能の準備がまだ完了していません。", schemaMissing: true };
    }
    const msg = error.message ?? "";
    if (msg.includes("policy") || msg.includes("violates") || error.code === "42501") {
      return { ok: false, error: "参加中のプロジェクトだけ取り組み中に設定できます。" };
    }
    return { ok: false, error: msg || "設定に失敗しました。" };
  }
  return { ok: true, error: null };
}

export async function clearWorkingOnProject(
  client: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error: string | null; schemaMissing?: boolean }> {
  const { error } = await client.from("user_project_focus").delete().eq("user_id", userId);
  if (error) {
    if (isSchemaMismatchError(error)) {
      return { ok: false, error: "取り組み中機能の準備がまだ完了していません。", schemaMissing: true };
    }
    return { ok: false, error: error.message || "解除に失敗しました。" };
  }
  return { ok: true, error: null };
}

export async function toggleProjectLike(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  currentlyLiked: boolean,
): Promise<{ ok: boolean; liked: boolean; error: string | null; schemaMissing?: boolean }> {
  if (currentlyLiked) {
    const { error } = await client
      .from("project_likes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) {
      if (isSchemaMismatchError(error)) {
        return { ok: false, liked: currentlyLiked, error: "いいね機能の準備がまだ完了していません。", schemaMissing: true };
      }
      return { ok: false, liked: currentlyLiked, error: error.message };
    }
    return { ok: true, liked: false, error: null };
  }

  const { error } = await client.from("project_likes").insert({ project_id: projectId, user_id: userId });
  if (error) {
    if (isSchemaMismatchError(error)) {
      return { ok: false, liked: currentlyLiked, error: "いいね機能の準備がまだ完了していません。", schemaMissing: true };
    }
    // unique violation → already liked
    if (error.code === "23505") return { ok: true, liked: true, error: null };
    return { ok: false, liked: currentlyLiked, error: error.message };
  }
  return { ok: true, liked: true, error: null };
}

export async function toggleProjectFavorite(
  client: SupabaseClient,
  userId: string,
  projectId: string,
  currentlyFavorited: boolean,
): Promise<{ ok: boolean; favorited: boolean; error: string | null; schemaMissing?: boolean }> {
  if (currentlyFavorited) {
    const { error } = await client
      .from("project_favorites")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
    if (error) {
      if (isSchemaMismatchError(error)) {
        return {
          ok: false,
          favorited: currentlyFavorited,
          error: "お気に入り機能の準備がまだ完了していません。",
          schemaMissing: true,
        };
      }
      return { ok: false, favorited: currentlyFavorited, error: error.message };
    }
    return { ok: true, favorited: false, error: null };
  }

  const { error } = await client.from("project_favorites").insert({ project_id: projectId, user_id: userId });
  if (error) {
    if (isSchemaMismatchError(error)) {
      return {
        ok: false,
        favorited: currentlyFavorited,
        error: "お気に入り機能の準備がまだ完了していません。",
        schemaMissing: true,
      };
    }
    if (error.code === "23505") return { ok: true, favorited: true, error: null };
    return { ok: false, favorited: currentlyFavorited, error: error.message };
  }
  return { ok: true, favorited: true, error: null };
}

export function matchesProjectQuery(project: ProjectRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    project.name,
    project.description ?? "",
    project.category ?? "",
    ...(project.tags ?? []),
    project.recruitment_target ?? "",
    project.recruitment_message ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export type ProjectSortKey = "newest" | "oldest" | "name" | "popular";

export function sortProjects(list: ProjectRow[], sort: ProjectSortKey, likeCounts?: Record<string, number>): ProjectRow[] {
  const copy = [...list];
  if (sort === "newest") {
    return copy.sort(
      (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime(),
    );
  }
  if (sort === "oldest") {
    return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  if (sort === "popular") {
    return copy.sort((a, b) => {
      const ac = likeCounts?.[a.id] ?? (typeof a.like_count === "number" ? a.like_count : 0);
      const bc = likeCounts?.[b.id] ?? (typeof b.like_count === "number" ? b.like_count : 0);
      if (bc !== ac) return bc - ac;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }
  return copy.sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
