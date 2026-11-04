import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CONTEST, DEMO_CONTEST_SECONDARY, DEMO_IDEAS, isMissingRelationError } from "@/lib/contest/demo";
import type {
  Contest,
  ContestGallerySort,
  ContestIdea,
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

export type ContestLobbyItem = Contest & { ideaCount: number };

const DEMO_LOBBY: ContestLobbyItem[] = [
  { ...DEMO_CONTEST, ideaCount: 0 },
  { ...DEMO_CONTEST_SECONDARY, ideaCount: 0 },
];

/** ロビー用：開催中〜終了のコンテスト一覧 */
export async function loadContestLobby(
  client: SupabaseClient,
  filter: "active" | "ended" | "all" = "active",
): Promise<{ items: ContestLobbyItem[]; demo: boolean }> {
  let q = client
    .from("contests")
    .select("id,title,description,why_text,reward_text,prompt_hint,category,start_at,end_at,status,created_at")
    .order("end_at", { ascending: true })
    .limit(40);

  if (filter === "active") q = q.eq("status", "active");
  if (filter === "ended") q = q.eq("status", "ended");

  const { data, error } = await q;
  if (error) {
    if (isMissingRelationError(error)) {
      const items =
        filter === "ended" ? [] : filter === "all" ? DEMO_LOBBY : DEMO_LOBBY.filter((c) => c.status === "active");
      return { items, demo: true };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) {
    const items =
      filter === "ended" ? [] : filter === "all" ? DEMO_LOBBY : DEMO_LOBBY.filter((c) => c.status === "active");
    return { items, demo: true };
  }

  const contests = rows.map((r) => mapContest(r));
  const counts = await Promise.all(
    contests.map(async (c) => {
      const { count } = await client
        .from("contest_ideas")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", c.id);
      return count ?? 0;
    }),
  );

  return {
    items: contests.map((c, i) => ({ ...c, ideaCount: counts[i] ?? 0 })),
    demo: false,
  };
}

export async function loadContestById(
  client: SupabaseClient,
  contestId: string,
): Promise<{ contest: Contest; demo: boolean }> {
  if (contestId === DEMO_CONTEST.id || contestId.startsWith("demo-contest")) {
    const fromLobby = DEMO_LOBBY.find((c) => c.id === contestId);
    return { contest: fromLobby ?? DEMO_CONTEST, demo: true };
  }
  const { data, error } = await client
    .from("contests")
    .select("id,title,description,why_text,reward_text,prompt_hint,category,start_at,end_at,status,created_at")
    .eq("id", contestId)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return { contest: DEMO_CONTEST, demo: true };
    throw new Error(error.message);
  }
  if (!data) return loadActiveContest(client);
  return { contest: mapContest(data as Record<string, unknown>), demo: false };
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

export async function loadContestIdeas(
  client: SupabaseClient,
  contestId: string,
  userId: string | null,
  sort: ContestGallerySort,
): Promise<{ ideas: ContestIdea[]; demo: boolean }> {
  if (contestId === DEMO_CONTEST.id || contestId.startsWith("demo-contest")) {
    let ideas =
      contestId === DEMO_CONTEST.id || contestId === "demo-contest"
        ? DEMO_IDEAS.map((e) => ({ ...e, contestId }))
        : [];
    if (sort === "newest") ideas = [...ideas].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else if (sort === "mine") ideas = userId ? ideas.filter((e) => e.userId === userId) : [];
    else ideas = [...ideas].sort((a, b) => b.likeCount - a.likeCount);
    return { ideas, demo: true };
  }

  let q = client
    .from("contest_ideas")
    .select("id,contest_id,user_id,title,content,appeal,roadmap_id,image_url,external_url,like_count,created_at")
    .eq("contest_id", contestId);

  if (sort === "mine") {
    if (!userId) return { ideas: [], demo: false };
    q = q.eq("user_id", userId).order("created_at", { ascending: false });
  } else if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q.order("like_count", { ascending: false }).order("created_at", { ascending: false });
  }

  const { data, error } = await q.limit(80);
  if (error) {
    if (isMissingRelationError(error)) {
      return loadContestIdeas(client, DEMO_CONTEST.id, userId, sort);
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return { ideas: [], demo: false };

  const ideaIds = rows.map((r) => String(r.id));
  const roadmapIds = [...new Set(rows.map((r) => r.roadmap_id).filter(Boolean).map(String))];
  const authorIds = [...new Set(rows.map((r) => String(r.user_id)))];

  const [{ data: roadmaps }, { data: profiles }, likesRes] = await Promise.all([
    roadmapIds.length
      ? client.from("roadmaps").select("id,user_id,title,steps,source_project_id,created_at").in("id", roadmapIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    client.from("profiles").select("id,display_name,avatar_url").in("id", authorIds),
    userId
      ? client.from("contest_idea_likes").select("idea_id").eq("user_id", userId).in("idea_id", ideaIds)
      : Promise.resolve({ data: [] as Array<{ idea_id: string }> }),
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
  const liked = new Set(((likesRes.data ?? []) as Array<{ idea_id: string }>).map((l) => l.idea_id));

  const ideas: ContestIdea[] = rows.map((r) => {
    const uid = String(r.user_id);
    const roadmapId = (r.roadmap_id as string | null) ?? null;
    return {
      id: String(r.id),
      contestId: String(r.contest_id),
      userId: uid,
      title: String(r.title ?? ""),
      content: String(r.content ?? ""),
      appeal: (r.appeal as string | null) ?? null,
      roadmapId,
      imageUrl: (r.image_url as string | null) ?? null,
      externalUrl: (r.external_url as string | null) ?? null,
      likeCount: Number(r.like_count ?? 0),
      createdAt: String(r.created_at),
      likedByMe: liked.has(String(r.id)),
      author: profileById.get(uid) ?? { id: uid, displayName: "ユーザー", avatarUrl: null },
      roadmap: roadmapId ? roadmapById.get(roadmapId) ?? null : null,
    };
  });

  return { ideas, demo: false };
}

export async function createRoadmapFromProject(
  client: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ContestRoadmap> {
  const [{ data: project }, { data: phases }] = await Promise.all([
    client.from("projects").select("id,name").eq("id", projectId).maybeSingle(),
    client
      .from("project_phases")
      .select('title,goal,"order"')
      .eq("project_id", projectId)
      .order("order", { ascending: true })
      .limit(12),
  ]);

  let steps: ContestRoadmapStep[] = ((phases ?? []) as Array<{ title?: string; goal?: string | null }>).map((p) => ({
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
    steps = ((legacy ?? []) as Array<{ title?: string }>).map((s) => ({
      title: String(s.title ?? "").trim() || "ステップ",
    }));
  }

  const title = String((project as { name?: string } | null)?.name ?? "マイロードマップ");
  const { data, error } = await client
    .from("roadmaps")
    .insert({
      user_id: userId,
      title: title.slice(0, 120),
      steps,
      source_project_id: projectId,
    })
    .select("id,user_id,title,steps,source_project_id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapRoadmap(data as Record<string, unknown>);
}

export type SubmitIdeaInput = {
  contestId: string;
  title: string;
  content: string;
  appeal?: string;
  roadmapId?: string | null;
  imageUrl?: string | null;
  externalUrl?: string | null;
};

export async function submitContestIdea(
  client: SupabaseClient,
  userId: string,
  input: SubmitIdeaInput,
): Promise<void> {
  const title = input.title.trim().slice(0, 40);
  const content = input.content.trim();
  if (!title || !content) throw new Error("タイトルと内容は必須です");

  const { error } = await client.from("contest_ideas").insert({
    contest_id: input.contestId,
    user_id: userId,
    title,
    content,
    appeal: input.appeal?.trim().slice(0, 140) || null,
    roadmap_id: input.roadmapId || null,
    image_url: input.imageUrl || null,
    external_url: input.externalUrl?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function toggleIdeaLike(
  client: SupabaseClient,
  userId: string,
  ideaId: string,
  currentlyLiked: boolean,
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await client.from("contest_idea_likes").delete().eq("idea_id", ideaId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("contest_idea_likes").insert({ idea_id: ideaId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function uploadContestImage(
  client: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください");
  if (file.size > 5 * 1024 * 1024) throw new Error("画像は5MB以下にしてください");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/contest/${Date.now()}.${ext}`;
  const { error } = await client.storage.from("post-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw new Error(error.message);
  return client.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}
