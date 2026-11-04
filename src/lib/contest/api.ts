import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CONTEST, DEMO_ENTRIES, isMissingRelationError } from "@/lib/contest/demo";
import type {
  Contest,
  ContestEntry,
  ContestGallerySort,
  ContestRoadmap,
  ContestRoadmapStep,
  ContestStatus,
} from "@/lib/contest/types";

function mapContest(row: Record<string, unknown>): Contest {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    whyText: (row.why_text as string | null) ?? null,
    rewardText: (row.reward_text as string | null) ?? null,
    promptHint: (row.prompt_hint as string | null) ?? null,
    category: String(row.category ?? "general"),
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    status: (row.status as ContestStatus) ?? "active",
    createdAt: String(row.created_at),
  };
}

function parseSteps(raw: unknown): ContestRoadmapStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ContestRoadmapStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const detail = typeof o.detail === "string" ? o.detail.trim() : "";
    out.push(detail ? { title, detail } : { title });
  }
  return out;
}

function mapRoadmap(row: Record<string, unknown>): ContestRoadmap {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    steps: parseSteps(row.steps),
    sourceProjectId: (row.source_project_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export function daysLeft(endAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endAt).getTime() - now) / 86400000));
}

export async function loadActiveContest(client: SupabaseClient): Promise<{ contest: Contest; demo: boolean }> {
  const { data, error } = await client
    .from("contests")
    .select("id,title,description,why_text,reward_text,prompt_hint,category,start_at,end_at,status,created_at")
    .eq("status", "active")
    .order("end_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return { contest: DEMO_CONTEST, demo: true };
    throw new Error(error.message);
  }
  if (!data) {
    const { data: anyRow, error: anyErr } = await client
      .from("contests")
      .select("id,title,description,why_text,reward_text,prompt_hint,category,start_at,end_at,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anyErr) {
      if (isMissingRelationError(anyErr)) return { contest: DEMO_CONTEST, demo: true };
      throw new Error(anyErr.message);
    }
    if (!anyRow) return { contest: DEMO_CONTEST, demo: true };
    return { contest: mapContest(anyRow as Record<string, unknown>), demo: false };
  }
  return { contest: mapContest(data as Record<string, unknown>), demo: false };
}

export async function loadContestEntries(
  client: SupabaseClient,
  contestId: string,
  userId: string | null,
  sort: ContestGallerySort,
): Promise<{ entries: ContestEntry[]; demo: boolean }> {
  if (contestId === DEMO_CONTEST.id) {
    let entries = DEMO_ENTRIES.map((e) => ({ ...e }));
    if (sort === "newest") entries = [...entries].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === "mine") entries = userId ? entries.filter((e) => e.userId === userId) : [];
    else if (sort === "popular") entries = [...entries].sort((a, b) => b.likeCount - a.likeCount);
    return { entries, demo: true };
  }

  let q = client
    .from("contest_entries")
    .select("id,contest_id,user_id,roadmap_id,comment,like_count,created_at")
    .eq("contest_id", contestId);

  if (sort === "mine") {
    if (!userId) return { entries: [], demo: false };
    q = q.eq("user_id", userId).order("created_at", { ascending: false });
  } else if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data, error } = await q.limit(80);
  if (error) {
    if (isMissingRelationError(error)) {
      return loadContestEntries(client, DEMO_CONTEST.id, userId, sort);
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return { entries: [], demo: false };

  const entryIds = rows.map((r) => String(r.id));
  const roadmapIds = [...new Set(rows.map((r) => String(r.roadmap_id)))];
  const authorIds = [...new Set(rows.map((r) => String(r.user_id)))];

  const [{ data: roadmaps }, { data: profiles }, likesRes] = await Promise.all([
    client.from("roadmaps").select("id,user_id,title,steps,source_project_id,created_at").in("id", roadmapIds),
    client.from("profiles").select("id,display_name,avatar_url").in("id", authorIds),
    userId
      ? client.from("contest_entry_likes").select("entry_id").eq("user_id", userId).in("entry_id", entryIds)
      : Promise.resolve({ data: [] as Array<{ entry_id: string }> }),
  ]);

  const roadmapById = new Map(
    ((roadmaps ?? []) as Array<Record<string, unknown>>).map((r) => [String(r.id), mapRoadmap(r)]),
  );
  const profileById = new Map(
    ((profiles ?? []) as Array<Record<string, unknown>>).map((p) => [
      String(p.id),
      {
        id: String(p.id),
        displayName: String((p.display_name as string) || "ユーザー").trim() || "ユーザー",
        avatarUrl: (p.avatar_url as string | null) ?? null,
      },
    ]),
  );
  const liked = new Set(((likesRes.data ?? []) as Array<{ entry_id: string }>).map((l) => l.entry_id));

  const entries: ContestEntry[] = [];
  for (const r of rows) {
    const roadmap = roadmapById.get(String(r.roadmap_id));
    if (!roadmap) continue;
    const uid = String(r.user_id);
    const author = profileById.get(uid) ?? {
      id: uid,
      displayName: "ユーザー",
      avatarUrl: null,
    };
    entries.push({
      id: String(r.id),
      contestId: String(r.contest_id),
      userId: uid,
      roadmapId: String(r.roadmap_id),
      comment: (r.comment as string | null) ?? null,
      likeCount: Number(r.like_count ?? 0),
      createdAt: String(r.created_at),
      likedByMe: liked.has(String(r.id)),
      author,
      roadmap,
    });
  }

  return { entries, demo: false };
}

export async function createRoadmap(
  client: SupabaseClient,
  userId: string,
  input: { title: string; steps: ContestRoadmapStep[]; sourceProjectId?: string | null },
): Promise<ContestRoadmap> {
  const { data, error } = await client
    .from("roadmaps")
    .insert({
      user_id: userId,
      title: input.title.trim().slice(0, 120),
      steps: input.steps,
      source_project_id: input.sourceProjectId ?? null,
    })
    .select("id,user_id,title,steps,source_project_id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapRoadmap(data as Record<string, unknown>);
}

export async function submitContestEntry(
  client: SupabaseClient,
  userId: string,
  input: { contestId: string; roadmapId: string; comment?: string },
): Promise<void> {
  const { error } = await client.from("contest_entries").insert({
    contest_id: input.contestId,
    user_id: userId,
    roadmap_id: input.roadmapId,
    comment: input.comment?.trim().slice(0, 140) || null,
  });
  if (error) throw new Error(error.message);
}

export async function toggleEntryLike(
  client: SupabaseClient,
  userId: string,
  entryId: string,
  currentlyLiked: boolean,
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await client
      .from("contest_entry_likes")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("contest_entry_likes").insert({
    entry_id: entryId,
    user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function loadProjectPhasesAsSteps(
  client: SupabaseClient,
  projectId: string,
): Promise<{ title: string; steps: ContestRoadmapStep[] }> {
  const [{ data: project }, { data: phases }] = await Promise.all([
    client.from("projects").select("id,name").eq("id", projectId).maybeSingle(),
    client
      .from("project_phases")
      .select('title,goal,"order"')
      .eq("project_id", projectId)
      .order("order", { ascending: true })
      .limit(12),
  ]);

  const title = String((project as { name?: string } | null)?.name ?? "マイロードマップ");
  const steps = ((phases ?? []) as Array<{ title?: string; goal?: string | null }>).map((p) => ({
    title: String(p.title ?? "").trim() || "ステップ",
    detail: p.goal ? String(p.goal).trim() : undefined,
  }));

  if (!steps.length) {
    const { data: legacy } = await client
      .from("project_roadmap_steps")
      .select("title,position")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .limit(12);
    const legacySteps = ((legacy ?? []) as Array<{ title?: string }>).map((s) => ({
      title: String(s.title ?? "").trim() || "ステップ",
    }));
    return { title, steps: legacySteps };
  }

  return { title, steps };
}
