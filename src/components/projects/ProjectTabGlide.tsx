"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildRoadmapTemplateRows, PROJECT_LINE_META } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { ensureOwnerMembership } from "@/lib/projects/ensureOwnerMembership";
import {
  applyBriefToCoachingContext,
  composeProjectDescription,
  emptyProjectBrief,
  type ProjectBrief,
} from "@/lib/projects/projectBrief";
import {
  clearWorkingOnProject,
  fetchFavoriteProjectIds,
  fetchMemberCounts,
  fetchOwnerNames,
  fetchPublicProjects,
  fetchSocialForProjects,
  fetchWorkingOnProjectId,
  matchesProjectQuery,
  setWorkingOnProject,
  sortProjects,
  toggleProjectFavorite,
  toggleProjectLike,
  type ProjectSortKey,
} from "@/lib/projects/projectSocial";
import { WorkingOnHero } from "@/components/projects/WorkingOnHero";
import { ProjectFeedCard } from "@/components/projects/ProjectFeedCard";
import type { ProjectCardMenuItem } from "@/components/projects/ProjectCardMenu";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type AppFeatureKey = "projects" | "articles" | "mentor" | "discovery" | "chat" | "account";

type Props = {
  hasSession: boolean;
  userId: string | null;
  onNavigate: (key: AppFeatureKey) => void;
  /** /projects ホーム用：画面いっぱいに広げる */
  fillViewport?: boolean;
  /** 招待承認などで一覧を再取得したいときに増やす */
  reloadSignal?: number;
};

/** 一覧用の列のみ。`select *` + order で RLS が重く statement timeout になりやすいため分割取得する */
const PROJECT_LIST_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,recruitment_target,recruitment_message,like_count,created_at,updated_at";

const PROJECT_LIST_SELECT_FALLBACKS = [
  PROJECT_LIST_SELECT,
  "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at",
  "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,created_at,updated_at",
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at",
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,created_at,updated_at",
  "id,owner_id,name,description,visibility,created_at,updated_at",
] as const;

function isSchemaMismatchError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function fetchProjectsByIds(
  client: NonNullable<typeof supabase>,
  ids: string[],
): Promise<{ rows: ProjectRow[]; error: string | null }> {
  if (ids.length === 0) return { rows: [], error: null };
  const batches = chunkIds(ids, 90);
  for (const select of PROJECT_LIST_SELECT_FALLBACKS) {
    let merged: ProjectRow[] = [];
    let failed: { code?: string; message?: string } | null = null;
    for (const batch of batches) {
      const res = await client.from("projects").select(select).in("id", batch);
      if (res.error) {
        failed = res.error;
        break;
      }
      merged = merged.concat((res.data ?? []) as unknown as ProjectRow[]);
    }
    if (!failed) return { rows: merged, error: null };
    if (!isSchemaMismatchError(failed)) return { rows: [], error: failed.message ?? "取得に失敗しました" };
  }
  return { rows: [], error: "プロジェクト一覧の取得に失敗しました。" };
}

async function fetchOwnedProjects(
  client: NonNullable<typeof supabase>,
  uid: string,
): Promise<{ rows: ProjectRow[]; error: string | null }> {
  for (const select of PROJECT_LIST_SELECT_FALLBACKS) {
    const res = await client
      .from("projects")
      .select(select)
      .eq("owner_id", uid)
      .order("updated_at", { ascending: false })
      .limit(120);
    if (!res.error) return { rows: (res.data ?? []) as unknown as ProjectRow[], error: null };
    if (!isSchemaMismatchError(res.error)) return { rows: [], error: res.error.message };
    const withoutOrder = await client.from("projects").select(select).eq("owner_id", uid).limit(120);
    if (!withoutOrder.error) return { rows: (withoutOrder.data ?? []) as unknown as ProjectRow[], error: null };
    if (!isSchemaMismatchError(withoutOrder.error)) return { rows: [], error: withoutOrder.error.message };
  }
  return { rows: [], error: "プロジェクト一覧の取得に失敗しました。" };
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const QUERY_TIMEOUT_MS = 12_000;

async function withQueryTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error(`${label}がタイムアウトしました。再読み込みしてください。`)),
        QUERY_TIMEOUT_MS,
      );
    }),
  ]);
}

export function ProjectTabGlide({
  hasSession,
  userId,
  onNavigate,
  fillViewport = false,
  reloadSignal = 0,
}: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const joinedSectionRef = useRef<HTMLElement | null>(null);
  const discoverSectionRef = useRef<HTMLElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [joinedProjects, setJoinedProjects] = useState<ProjectRow[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [publicProjects, setPublicProjects] = useState<ProjectRow[]>([]);
  const [favoriteProjects, setFavoriteProjects] = useState<ProjectRow[]>([]);
  const [workingOnId, setWorkingOnId] = useState<string | null>(null);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [socialSchemaMissing, setSocialSchemaMissing] = useState(false);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProjectSortKey>("newest");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAllJoined, setShowAllJoined] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [busyLikeId, setBusyLikeId] = useState<string | null>(null);
  const [busyFavoriteId, setBusyFavoriteId] = useState<string | null>(null);
  const [busyFocusId, setBusyFocusId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    business_type: "software" as "maker" | "software" | "social",
    visibility: "public" as "public" | "private",
    category: "探究",
    tags: "",
    recruitment_target: "",
    recruitment_message: "",
    thumbnail_url: "",
  });
  const [brief, setBrief] = useState<ProjectBrief>(() => emptyProjectBrief());
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    const uid = userId;
    setLoading(true);
    setErr("");
    let settled = false;
    const hardStop = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setLoading(false);
      setErr((prev) => prev || tx("読み込みがタイムアウトしました。再読み込みしてください。", "Load timed out. Please reload."));
    }, 12_000);

    try {
      let mergedJoined: ProjectRow[] = [];
      if (uid) {
        const ownedResult = await withQueryTimeout(fetchOwnedProjects(client, uid), "プロジェクト一覧");
        if (ownedResult.error) setErr(ownedResult.error);

        let memberIds: string[] = [];
        try {
          const memRes = await withQueryTimeout(
            client.from("project_members").select("project_id").eq("user_id", uid),
            "参加プロジェクト",
          );
          if (memRes.error) {
            setErr((prev) => prev || memRes.error.message);
          } else {
            memberIds = [...new Set((memRes.data ?? []).map((m: { project_id: string }) => m.project_id))];
          }
        } catch (e) {
          setErr((prev) => prev || (e instanceof Error ? e.message : "参加プロジェクトの取得に失敗しました。"));
        }

        const memberResult =
          memberIds.length > 0
            ? await withQueryTimeout(fetchProjectsByIds(client, memberIds), "参加プロジェクト詳細")
            : { rows: [] as ProjectRow[], error: null };
        if (memberResult.error) setErr((prev) => prev || memberResult.error || "");

        const byId = new Map<string, ProjectRow>();
        for (const row of [...(memberResult.rows ?? []), ...(ownedResult.rows ?? [])]) {
          byId.set(row.id, row);
        }
        mergedJoined = [...byId.values()].sort(
          (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime(),
        );
        void Promise.all(
          mergedJoined
            .filter((p) => p.owner_id === uid)
            .map((p) => ensureOwnerMembership(p.id, p.owner_id).catch(() => undefined)),
        );
      }
      setJoinedProjects(mergedJoined.slice(0, 200));
      setJoinedIds(new Set(mergedJoined.map((p) => p.id)));

      const pubRes = await fetchPublicProjects(client, 80);
      if (pubRes.error) setErr((prev) => prev || pubRes.error || "");
      setPublicProjects(pubRes.rows);

      let favoriteRows: ProjectRow[] = [];
      let focusId: string | null = null;
      if (uid) {
        const [favIdsRes, focusRes] = await Promise.all([
          fetchFavoriteProjectIds(client, uid),
          fetchWorkingOnProjectId(client, uid),
        ]);
        focusId = focusRes.projectId;
        if (focusRes.schemaMissing || favIdsRes.schemaMissing) setSocialSchemaMissing(true);
        if (favIdsRes.ids.length > 0) {
          const favFetch = await fetchProjectsByIds(client, favIdsRes.ids);
          const favMap = new Map(favFetch.rows.map((p) => [p.id, p]));
          favoriteRows = favIdsRes.ids.map((id) => favMap.get(id)).filter(Boolean) as ProjectRow[];
        }
      }
      setWorkingOnId(focusId);
      setFavoriteProjects(favoriteRows);

      const allForMeta = [...mergedJoined, ...pubRes.rows, ...favoriteRows];
      const uniqueIds = [...new Set(allForMeta.map((p) => p.id))];
      const ownerIds = [...new Set(allForMeta.map((p) => p.owner_id))];

      const [counts, names, social] = await Promise.all([
        fetchMemberCounts(client, uniqueIds),
        fetchOwnerNames(client, ownerIds),
        fetchSocialForProjects(client, uid, uniqueIds),
      ]);
      setMemberCounts(counts);
      setOwnerNames(names);
      setLikedIds(social.likedIds);
      setFavoritedIds(social.favoritedIds);
      const countsFromRows: Record<string, number> = {};
      for (const p of allForMeta) {
        if (typeof p.like_count === "number") countsFromRows[p.id] = p.like_count;
      }
      setLikeCounts({ ...countsFromRows, ...social.likeCounts });
      if (social.socialSchemaMissing) setSocialSchemaMissing(true);
      else setSocialSchemaMissing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("読み込みに失敗しました。", "Failed to load."));
    } finally {
      settled = true;
      window.clearTimeout(hardStop);
      setLoading(false);
    }
  }, [userId, tx]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (reloadSignal <= 0) return;
    void load().catch(() => undefined);
  }, [reloadSignal, load]);

  const workingOnProject = useMemo(() => {
    if (!workingOnId) return null;
    return (
      joinedProjects.find((p) => p.id === workingOnId) ||
      publicProjects.find((p) => p.id === workingOnId) ||
      favoriteProjects.find((p) => p.id === workingOnId) ||
      null
    );
  }, [workingOnId, joinedProjects, publicProjects, favoriteProjects]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of [...joinedProjects, ...publicProjects]) {
      const c = p.category?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ja"));
  }, [joinedProjects, publicProjects]);

  const filteredJoined = useMemo(() => {
    let list = joinedProjects.filter((p) => matchesProjectQuery(p, query));
    if (categoryFilter !== "all") list = list.filter((p) => (p.category?.trim() || "") === categoryFilter);
    return sortProjects(list, sort === "popular" ? "newest" : sort, likeCounts);
  }, [joinedProjects, query, categoryFilter, sort, likeCounts]);

  const filteredFavorites = useMemo(() => {
    let list = favoriteProjects.filter((p) => matchesProjectQuery(p, query));
    if (categoryFilter !== "all") list = list.filter((p) => (p.category?.trim() || "") === categoryFilter);
    return list;
  }, [favoriteProjects, query, categoryFilter]);

  const discoverList = useMemo(() => {
    const list = publicProjects.filter((p) => {
      if (joinedIds.has(p.id)) return false;
      if (!matchesProjectQuery(p, query)) return false;
      if (categoryFilter !== "all" && (p.category?.trim() || "") !== categoryFilter) return false;
      return true;
    });
    return sortProjects(list, sort, likeCounts);
  }, [publicProjects, joinedIds, query, categoryFilter, sort, likeCounts]);

  const joinedPreview = showAllJoined ? filteredJoined : filteredJoined.slice(0, 8);
  const searching = query.trim().length > 0 || categoryFilter !== "all";

  async function requireAuth(): Promise<string | null> {
    if (!supabase || !userId) {
      flash(tx("ログインが必要です。", "Please sign in."));
      onNavigate("account");
      return null;
    }
    return userId;
  }

  function openCreate() {
    if (!hasSession) {
      flash(tx("ログインが必要です。", "Please sign in."));
      onNavigate("account");
      return;
    }
    setCreateOpen(true);
  }

  async function onToggleLike(projectId: string) {
    const uid = await requireAuth();
    if (!uid || !supabase || busyLikeId) return;
    if (socialSchemaMissing) {
      flash(tx("いいね機能の準備がまだ完了していません。", "Likes are not available yet."));
      return;
    }
    const currentlyLiked = likedIds.has(projectId);
    const prevCount = likeCounts[projectId] ?? 0;
    setBusyLikeId(projectId);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [projectId]: Math.max(0, prevCount + (currentlyLiked ? -1 : 1)),
    }));
    try {
      const res = await toggleProjectLike(supabase, uid, projectId, currentlyLiked);
      if (!res.ok) {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (currentlyLiked) next.add(projectId);
          else next.delete(projectId);
          return next;
        });
        setLikeCounts((prev) => ({ ...prev, [projectId]: prevCount }));
        if (res.schemaMissing) setSocialSchemaMissing(true);
        flash(res.error || tx("いいねに失敗しました。", "Could not update like."));
        return;
      }
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (res.liked) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
    } finally {
      setBusyLikeId(null);
    }
  }

  async function onToggleFavorite(projectId: string) {
    const uid = await requireAuth();
    if (!uid || !supabase || busyFavoriteId) return;
    if (socialSchemaMissing) {
      flash(tx("お気に入り機能の準備がまだ完了していません。", "Favorites are not available yet."));
      return;
    }
    const currentlyFavorited = favoritedIds.has(projectId);
    setBusyFavoriteId(projectId);
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (currentlyFavorited) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    if (currentlyFavorited) {
      setFavoriteProjects((prev) => prev.filter((p) => p.id !== projectId));
    } else {
      const found =
        joinedProjects.find((p) => p.id === projectId) ||
        publicProjects.find((p) => p.id === projectId) ||
        null;
      if (found) setFavoriteProjects((prev) => [found, ...prev.filter((p) => p.id !== projectId)]);
    }
    try {
      const res = await toggleProjectFavorite(supabase, uid, projectId, currentlyFavorited);
      if (!res.ok) {
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (currentlyFavorited) next.add(projectId);
          else next.delete(projectId);
          return next;
        });
        void load();
        if (res.schemaMissing) setSocialSchemaMissing(true);
        flash(res.error || tx("お気に入りの更新に失敗しました。", "Could not update favorite."));
        return;
      }
      flash(
        res.favorited
          ? tx("お気に入りに保存しました", "Saved to favorites")
          : tx("お気に入りを解除しました", "Removed from favorites"),
      );
    } finally {
      setBusyFavoriteId(null);
    }
  }

  async function onSetWorkingOn(projectId: string) {
    const uid = await requireAuth();
    if (!uid || !supabase || busyFocusId) return;
    if (!joinedIds.has(projectId)) {
      flash(tx("参加中のプロジェクトだけ取り組み中に設定できます。", "Only joined projects can be set as working on."));
      return;
    }
    setBusyFocusId(projectId);
    const prev = workingOnId;
    setWorkingOnId(projectId);
    try {
      const res = await setWorkingOnProject(supabase, uid, projectId);
      if (!res.ok) {
        setWorkingOnId(prev);
        if (res.schemaMissing) setSocialSchemaMissing(true);
        flash(res.error || tx("設定に失敗しました。", "Could not update."));
        return;
      }
      flash(tx("取り組み中に設定しました", "Set as working on"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusyFocusId(null);
    }
  }

  async function onClearWorkingOn() {
    const uid = await requireAuth();
    if (!uid || !supabase || busyFocusId) return;
    setBusyFocusId(workingOnId ?? "clear");
    const prev = workingOnId;
    setWorkingOnId(null);
    try {
      const res = await clearWorkingOnProject(supabase, uid);
      if (!res.ok) {
        setWorkingOnId(prev);
        if (res.schemaMissing) setSocialSchemaMissing(true);
        flash(res.error || tx("解除に失敗しました。", "Could not clear."));
        return;
      }
      flash(tx("取り組み中を解除しました", "Cleared working on"));
    } finally {
      setBusyFocusId(null);
    }
  }

  function menuForProject(project: ProjectRow): ProjectCardMenuItem[] {
    const items: ProjectCardMenuItem[] = [];
    const isMember = joinedIds.has(project.id);
    if (isMember) {
      if (workingOnId === project.id) {
        items.push({
          id: "clear-focus",
          label: tx("取り組み中を解除", "Clear working on"),
          onSelect: () => void onClearWorkingOn(),
          disabled: Boolean(busyFocusId),
        });
      } else {
        items.push({
          id: "set-focus",
          label: tx("取り組み中に設定", "Set as working on"),
          onSelect: () => void onSetWorkingOn(project.id),
          disabled: Boolean(busyFocusId),
        });
      }
    }
    items.push({
      id: "open",
      label: tx("プロジェクトを開く", "Open project"),
      onSelect: () => router.push(`/projects/${project.id}/overview`),
    });
    return items;
  }

  async function onCreate() {
    if (!supabase || !form.name.trim()) return;
    setBusy(true);
    setErr("");
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user.id;
    if (!uid) {
      setErr(tx("ログインが必要です。", "Please sign in."));
      setBusy(false);
      return;
    }
    const description = composeProjectDescription(brief);
    const coaching_context = applyBriefToCoachingContext({}, brief);
    const fullPayload = {
      owner_id: uid,
      name: form.name.trim(),
      description,
      coaching_context,
      business_type: form.business_type,
      category: form.category.trim() || "探究",
      tags: form.tags.split(/[,、]/).map((x) => x.trim()).filter(Boolean),
      thumbnail_url: form.thumbnail_url.trim() || null,
      visibility: form.visibility,
      recruitment_target: form.recruitment_target.trim(),
      recruitment_message: form.recruitment_message.trim(),
    };
    const payloadCandidates: Array<Record<string, unknown>> = [
      fullPayload,
      {
        owner_id: uid,
        name: fullPayload.name,
        description: fullPayload.description,
        coaching_context: fullPayload.coaching_context,
        business_type: fullPayload.business_type,
        category: fullPayload.category,
        tags: fullPayload.tags,
        visibility: fullPayload.visibility,
      },
      {
        owner_id: uid,
        name: fullPayload.name,
        description: fullPayload.description,
        business_type: fullPayload.business_type,
        category: fullPayload.category,
        tags: fullPayload.tags,
        visibility: fullPayload.visibility,
      },
      {
        owner_id: uid,
        name: fullPayload.name,
        description: fullPayload.description,
      },
      {
        owner_id: uid,
        name: fullPayload.name,
      },
    ];
    let data: { id: string } | null = null;
    let error: { message: string; code?: string } | null = null;
    for (const candidate of payloadCandidates) {
      const res = await supabase.from("projects").insert(candidate).select("id").single();
      data = (res.data as { id: string } | null) ?? null;
      error = (res.error as { message: string; code?: string } | null) ?? null;
      if (!error) break;
      const schemaMismatch =
        error.code === "42703" ||
        error.code === "PGRST204" ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache");
      if (!schemaMismatch) break;
    }
    if (error || !data?.id) {
      setErr(error?.message ?? tx("プロジェクトの作成に失敗しました。", "Could not create project."));
      setBusy(false);
      return;
    }
    const projectId = data.id as string;
    const { error: memErr } = await supabase
      .from("project_members")
      .upsert(
        { project_id: projectId, user_id: uid, role: "owner" },
        { onConflict: "project_id,user_id" },
      );
    if (memErr) {
      setErr(`プロジェクトは作成されましたが、オーナーのメンバー登録に失敗しました: ${memErr.message}`);
    }
    try {
      const templateRows = buildRoadmapTemplateRows(projectId, fullPayload.business_type);
      const { error: roadmapSeedErr } = await supabase.from("project_roadmap_steps").insert(templateRows);
      if (roadmapSeedErr) {
        console.warn("[projects] roadmap template seed skipped:", roadmapSeedErr.message);
      }
    } catch {
      /* テーブル未適用などは無視 */
    }
    setCreateOpen(false);
    setForm({
      name: "",
      business_type: "software",
      category: "探究",
      tags: "",
      visibility: "public",
      recruitment_target: "",
      recruitment_message: "",
      thumbnail_url: "",
    });
    setBrief(emptyProjectBrief());
    setShowAdvancedFields(false);
    setBusy(false);
    void load();
    if (data?.id) router.push(`/projects/${data.id as string}/overview`);
  }

  const toastOk =
    toast.includes("しました") ||
    toast.toLowerCase().includes("saved") ||
    toast.toLowerCase().includes("set as") ||
    toast.toLowerCase().includes("cleared") ||
    toast.toLowerCase().includes("removed");

  return (
    <div
      className={
        fillViewport
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--startup-bg)]"
          : "flex min-h-[min(72vh,720px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--startup-bg)] shadow-sm"
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-20 shrink-0 border-b border-zinc-200/70 bg-white/90 px-3 py-2.5 backdrop-blur-sm sm:px-5">
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                className="w-full min-h-[40px] rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white"
                placeholder={tx("プロジェクトを検索", "Search projects")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={tx("プロジェクトを検索", "Search projects")}
              />
            </label>
            <label className="shrink-0">
              <span className="sr-only">{tx("並び順", "Sort")}</span>
              <select
                className="min-h-[40px] rounded-xl border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-700"
                value={sort}
                onChange={(e) => setSort(e.target.value as ProjectSortKey)}
                aria-label={tx("並び順", "Sort")}
              >
                <option value="newest">{tx("新しい順", "Newest")}</option>
                <option value="popular">{tx("人気順", "Popular")}</option>
                <option value="oldest">{tx("古い順", "Oldest")}</option>
                <option value="name">{tx("名前", "Name")}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800"
              aria-label={tx("新規プロジェクト", "New project")}
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
          {categories.length > 0 ? (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  categoryFilter === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {tx("すべて", "All")}
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    categoryFilter === c ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {err ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <p className="text-sm text-rose-600">{err}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
              onClick={() => void load()}
            >
              {tx("再読み込み", "Reload")}
            </button>
          </div>
        ) : null}

        {toast ? (
          <div
            className={`mx-3 mt-2 rounded-xl px-3 py-2 text-xs font-medium sm:mx-5 ${
              toastOk ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            }`}
            role="status"
          >
            {toast}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-3 py-4 pb-10 sm:px-5 sm:py-5">
            {/* A/B: Working on hero */}
            {!hasSession ? (
              <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-[#fff8f4] via-white to-[#f4f7fb] px-5 py-8 sm:px-8">
                <h2
                  className="text-2xl leading-tight text-zinc-900 sm:text-3xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {tx("アイディアを実現する拠点へ", "Your hub for turning ideas into action")}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
                  {tx(
                    "ログインすると、取り組み中のプロジェクトや参加中・お気に入りをここにまとめられます。公開プロジェクトは下から探せます。",
                    "Sign in to pin what you’re working on and manage joined and saved projects. Browse public projects below.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("account")}
                  className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
                >
                  {tx("ログインする", "Log in")}
                </button>
              </section>
            ) : (
              <WorkingOnHero
                project={workingOnProject}
                memberCount={workingOnProject ? memberCounts[workingOnProject.id] ?? 0 : 0}
                loading={loading && !workingOnProject}
                onPromptSet={() => joinedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              />
            )}

            {/* C: Joined */}
            <section ref={joinedSectionRef} aria-labelledby="joined-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="joined-heading" className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
                    {tx("参加中のプロジェクト", "Joined projects")}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {tx("オーナーまたはメンバーとして関わっている活動", "Projects you own or are a member of")}
                  </p>
                </div>
                {filteredJoined.length > 8 ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-[var(--startup-accent)]"
                    onClick={() => setShowAllJoined((v) => !v)}
                  >
                    {showAllJoined ? tx("閉じる", "Show less") : tx("すべて見る", "See all")}
                  </button>
                ) : null}
              </div>

              {loading && joinedProjects.length === 0 ? (
                <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
              ) : filteredJoined.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-zinc-800">
                    {searching
                      ? tx("条件に合う参加中プロジェクトはありません", "No joined projects match")
                      : tx("参加しているプロジェクトはまだありません", "You haven’t joined a project yet")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {tx("新しく作るか、下のみんなのプロジェクトから見つけてみましょう。", "Create one, or discover public projects below.")}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      className="min-h-[40px] rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
                      onClick={openCreate}
                    >
                      {tx("プロジェクトを作る", "Create project")}
                    </button>
                    <button
                      type="button"
                      className="min-h-[40px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                      onClick={() => discoverSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                    >
                      {tx("みんなのプロジェクトを見る", "Browse public projects")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={openCreate}
                    className="flex w-[11.5rem] shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-white/80 transition hover:border-zinc-400 sm:w-[13rem]"
                  >
                    <div className="flex aspect-[4/3] items-center justify-center bg-zinc-50">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-2xl font-light text-white">
                        +
                      </span>
                    </div>
                    <div className="px-2.5 py-2.5 text-left">
                      <p className="text-sm font-semibold text-zinc-800">{tx("新規プロジェクト", "New project")}</p>
                      <p className="text-[11px] text-zinc-500">{tx("作って仲間を集める", "Create and invite")}</p>
                    </div>
                  </button>
                  {joinedPreview.map((project) => (
                    <ProjectFeedCard
                      key={project.id}
                      project={project}
                      variant="rail"
                      ownerName={
                        project.owner_id === userId
                          ? tx("あなた", "You")
                          : ownerNames[project.owner_id]
                      }
                      memberCount={memberCounts[project.id] ?? 0}
                      likeCount={likeCounts[project.id] ?? project.like_count ?? 0}
                      likedByMe={likedIds.has(project.id)}
                      favoritedByMe={favoritedIds.has(project.id)}
                      showSocial
                      menuItems={menuForProject(project)}
                      likeBusy={busyLikeId === project.id}
                      favoriteBusy={busyFavoriteId === project.id}
                      onToggleLike={() => void onToggleLike(project.id)}
                      onToggleFavorite={() => void onToggleFavorite(project.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* D: Favorites */}
            <section aria-labelledby="favorites-heading">
              <div className="mb-3">
                <h2 id="favorites-heading" className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
                  {tx("お気に入りのプロジェクト", "Favorite projects")}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {tx("あとから見返すために保存したプロジェクト", "Projects you’ve bookmarked to revisit")}
                </p>
              </div>
              {filteredFavorites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-zinc-800">
                    {searching
                      ? tx("条件に合うお気に入りはありません", "No favorites match")
                      : tx("まだお気に入りはありません", "No favorites yet")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {tx("公開プロジェクトの保存ボタンから登録できます。", "Tap Save on a public project to bookmark it.")}
                  </p>
                  <button
                    type="button"
                    className="mt-3 min-h-[40px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
                    onClick={() => discoverSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {tx("公開プロジェクトを探す", "Discover public projects")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredFavorites.map((project) => (
                    <ProjectFeedCard
                      key={project.id}
                      project={project}
                      variant="compact"
                      ownerName={
                        project.owner_id === userId
                          ? tx("あなた", "You")
                          : ownerNames[project.owner_id]
                      }
                      memberCount={memberCounts[project.id] ?? 0}
                      likeCount={likeCounts[project.id] ?? project.like_count ?? 0}
                      likedByMe={likedIds.has(project.id)}
                      favoritedByMe={favoritedIds.has(project.id)}
                      showSocial
                      menuItems={menuForProject(project)}
                      likeBusy={busyLikeId === project.id}
                      favoriteBusy={busyFavoriteId === project.id}
                      onToggleLike={() => void onToggleLike(project.id)}
                      onToggleFavorite={() => void onToggleFavorite(project.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* E: Discover */}
            <section ref={discoverSectionRef} aria-labelledby="discover-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="discover-heading" className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
                    {tx("みんなのプロジェクト", "Everyone’s projects")}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {tx("公開されている、まだ参加していないアイディア", "Public ideas you haven’t joined yet")}
                  </p>
                </div>
                <Link
                  href="/?tab=chat"
                  className="shrink-0 text-xs font-semibold text-[var(--startup-accent)]"
                >
                  {tx("探すタブへ", "Open Discover")}
                </Link>
              </div>

              {loading && publicProjects.length === 0 ? (
                <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
              ) : discoverList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-zinc-800">
                    {searching
                      ? tx("検索条件に合う公開プロジェクトはありません", "No public projects match your search")
                      : tx("いま表示できる公開プロジェクトはありません", "No public projects to show right now")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {searching
                      ? tx("キーワードやカテゴリを変えてみてください。", "Try a different keyword or category.")
                      : tx("自分のプロジェクトを公開すると、ここに並ぶ可能性があります。", "Publishing your own project helps others find you.")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {discoverList.map((project) => (
                    <ProjectFeedCard
                      key={project.id}
                      project={project}
                      ownerName={ownerNames[project.owner_id]}
                      memberCount={memberCounts[project.id] ?? 0}
                      likeCount={likeCounts[project.id] ?? project.like_count ?? 0}
                      likedByMe={likedIds.has(project.id)}
                      favoritedByMe={favoritedIds.has(project.id)}
                      showSocial
                      menuItems={menuForProject(project)}
                      likeBusy={busyLikeId === project.id}
                      favoriteBusy={busyFavoriteId === project.id}
                      onToggleLike={() => void onToggleLike(project.id)}
                      onToggleFavorite={() => void onToggleFavorite(project.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{tx("新規プロジェクト", "New project")}</h3>
              <button type="button" className="text-sm text-zinc-500" onClick={() => setCreateOpen(false)}>
                {tx("閉じる", "Close")}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                placeholder={tx("名前 *", "Name *")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <p className="text-xs font-semibold text-zinc-700">{tx("プロジェクトの詳細", "Project details")}</p>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  {tx(
                    "あとから設定で編集できます。思いつきの背景を残しておくと、仲間にも伝わりやすくなります。",
                    "You can edit this later. Capturing the background helps teammates understand.",
                  )}
                </p>
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-600">
                    {tx(
                      "どのようなことを解決したくてこのプロジェクトを思いついたか",
                      "What problem sparked this project?",
                    )}
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    rows={3}
                    value={brief.problemMotivation}
                    onChange={(e) => setBrief((b) => ({ ...b, problemMotivation: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-600">{tx("このプロジェクトのゴール", "Goal")}</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    rows={2}
                    value={brief.projectGoal}
                    onChange={(e) => setBrief((b) => ({ ...b, projectGoal: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-600">{tx("何をするのか", "What will you do?")}</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    rows={2}
                    value={brief.whatToDo}
                    onChange={(e) => setBrief((b) => ({ ...b, whatToDo: e.target.value }))}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-700">{tx("プロジェクトの系統", "Project line")}</p>
                <div className="grid gap-2">
                  {(["software", "maker", "social"] as const).map((bt) => {
                    const meta = PROJECT_LINE_META[bt];
                    const selected = form.business_type === bt;
                    return (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, business_type: bt }))}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          selected
                            ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        }`}
                      >
                        <span className="text-xl leading-none" aria-hidden>
                          {meta.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-zinc-900">{meta.shortLabel}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{meta.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <select
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as "public" | "private" }))}
              >
                <option value="public">{tx("公開", "Public")}</option>
                <option value="private">{tx("非公開", "Private")}</option>
              </select>
              <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                <p className="text-xs font-semibold text-emerald-900">{tx("欲しい人材（任意）", "Roles wanted (optional)")}</p>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  placeholder={tx("例: デザイナー、エンジニア、マーケ", "e.g. designer, engineer")}
                  value={form.recruitment_target}
                  onChange={(e) => setForm((f) => ({ ...f, recruitment_target: e.target.value }))}
                />
                <textarea
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  rows={2}
                  placeholder={tx("募集文・一緒にやりたいこと（任意）", "Recruitment message (optional)")}
                  value={form.recruitment_message}
                  onChange={(e) => setForm((f) => ({ ...f, recruitment_message: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-600"
                onClick={() => setShowAdvancedFields((prev) => !prev)}
              >
                {showAdvancedFields
                  ? tx("詳細設定を閉じる", "Hide advanced")
                  : tx("詳細設定（任意）を開く", "Show advanced (optional)")}
              </button>
              {showAdvancedFields ? (
                <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2">
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder={tx("カテゴリ（任意）", "Category (optional)")}
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder={tx("タグ（任意・カンマ区切り）", "Tags (optional, comma-separated)")}
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder={tx("サムネURL（任意）", "Thumbnail URL (optional)")}
                    value={form.thumbnail_url}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busy || !form.name.trim()}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void onCreate()}
            >
              {busy ? tx("作成中…", "Creating…") : tx("作成して開く", "Create and open")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
