"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildRoadmapTemplateRows, PROJECT_LINE_META } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { ActiveProjectCard } from "@/components/home/ActiveProjectCard";
import { ProjectCubeCarousel } from "@/components/projects/ProjectCubeCarousel";
import { Bell } from "lucide-react";
import { ensureOwnerMembership } from "@/lib/projects/ensureOwnerMembership";
import { fetchIncomingProjectInvites, fetchMyProjectNotifications } from "@/lib/projects/projectInvites";
import { ProjectInviteBellPanel } from "@/components/projects/ProjectInviteBellPanel";

export type AppFeatureKey = "projects" | "posts" | "articles" | "mentor" | "discovery" | "chat" | "account";

type SortKey = "newest" | "oldest" | "name";

type Props = {
  hasSession: boolean;
  userId: string | null;
  onNavigate: (key: AppFeatureKey) => void;
  /** /projects ホーム用：画面いっぱいに広げる */
  fillViewport?: boolean;
};

/** 一覧用の列のみ。`select *` + order で RLS が重く statement timeout になりやすいため分割取得する */
const PROJECT_LIST_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,icon,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

const PROJECT_LIST_SELECT_FALLBACKS = [
  PROJECT_LIST_SELECT,
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
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [err, setErr] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    business_type: "software" as "maker" | "software" | "social",
    visibility: "public" as "public" | "private",
    category: "探究",
    tags: "",
    recruitment_target: "",
    recruitment_message: "",
    thumbnail_url: "",
  });
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToast, setInviteToast] = useState("");
  const [bellBadge, setBellBadge] = useState(0);

  const flashInviteToast = useCallback((message: string) => {
    setInviteToast(message);
    window.setTimeout(() => setInviteToast(""), 2600);
  }, []);

  const refreshBellBadge = useCallback(async (uid: string) => {
    const [invites, notes] = await Promise.all([
      fetchIncomingProjectInvites(uid),
      fetchMyProjectNotifications(uid, 40),
    ]);
    const unreadNotes = notes.filter((n) => !n.read_at && n.type !== "project_invite").length;
    setBellBadge(invites.length + unreadNotes);
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    setLoading(true);
    setErr("");
    try {
      const uid = userId;
      if (!uid) {
        setCurrentUserId(null);
        setProjects([]);
        setJoinedIds(new Set());
        return;
      }
      setCurrentUserId(uid);

      const ownedResult = await withQueryTimeout(fetchOwnedProjects(client, uid), "プロジェクト一覧");
      if (ownedResult.error) {
        setErr(ownedResult.error);
      }

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
      if (memberResult.error) {
        setErr((prev) => prev || memberResult.error || "");
      }

      const byId = new Map<string, ProjectRow>();
      for (const row of [...(memberResult.rows ?? []), ...(ownedResult.rows ?? [])]) {
        byId.set(row.id, row);
      }
      const merged = [...byId.values()].sort(
        (a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime(),
      );
      // オーナーなのに members にいないケースを自己修復
      await Promise.all(
        merged
          .filter((p) => p.owner_id === uid)
          .map((p) => ensureOwnerMembership(p.id, p.owner_id).catch(() => undefined)),
      );
      setProjects(merged.slice(0, 200));
      setJoinedIds(new Set(merged.map((p) => p.id)));
      void refreshBellBadge(uid);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [userId, refreshBellBadge]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  const displayList = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (!q) return true;
      return `${p.name} ${p.description} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
    if (sort === "newest") {
      list = [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sort === "oldest") {
      list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ja"));
    }
    return list;
  }, [projects, query, sort]);

  /** 招待URLを出してよいのはメンバーまたはオーナーのみ（閲覧のみの公開PJは除外） */
  const inviteEligibleProjects = useMemo(() => {
    if (!currentUserId) return [];
    return displayList.filter((p) => joinedIds.has(p.id) || p.owner_id === currentUserId);
  }, [displayList, joinedIds, currentUserId]);

  async function onCreate() {
    if (!supabase || !form.name.trim()) return;
    setBusy(true);
    setErr("");
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user.id;
    if (!uid) {
      setErr("ログインが必要です。");
      setBusy(false);
      return;
    }
    const fullPayload = {
      owner_id: uid,
      name: form.name.trim(),
      description: form.description.trim(),
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
      setErr(error?.message ?? "プロジェクトの作成に失敗しました。");
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
      /* テーブル未適用などは無視（作成自体は成功している） */
    }
    setCreateOpen(false);
    setForm({
      name: "",
      description: "",
      business_type: "software",
      category: "探究",
      tags: "",
      visibility: "public",
      recruitment_target: "",
      recruitment_message: "",
      thumbnail_url: "",
    });
    setShowAdvancedFields(false);
    setBusy(false);
    void load();
    if (data?.id) router.push(`/projects/${data.id as string}/overview`);
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-[min(70vh,640px)] flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 text-center">
        <p className="text-lg font-bold text-zinc-900">プロジェクトを始めよう</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-600">ログインすると、プロジェクトの作成・参加ができます。</p>
        <button type="button" className="mt-4 min-h-[44px] rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white" onClick={() => onNavigate("account")}>
          ログインする
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        fillViewport
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          : "flex min-h-[min(72vh,720px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 shadow-sm"
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <header
          className={`relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-100/80 bg-white/90 px-3 backdrop-blur-sm sm:px-5 ${
            fillViewport ? "py-1.5" : "px-4 py-2.5 lg:px-6"
          }`}
        >
          <div className={fillViewport ? "min-w-0" : undefined}>
            <h2 className={`font-bold tracking-tight text-zinc-900 ${fillViewport ? "text-base sm:text-lg" : "text-xl sm:text-2xl"}`}>
              マイプロジェクト
            </h2>
            {!fillViewport ? (
              <p className="mt-0.5 text-[11px] text-zinc-500">参加中のプロジェクトだけ表示されます</p>
            ) : null}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:flex-initial sm:min-w-0 sm:gap-2">
            <label className={`relative min-w-0 flex-1 ${fillViewport ? "max-w-[9.5rem] sm:max-w-xs" : "sm:max-w-xs"}`}>
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] leading-none sm:left-3 sm:text-[15px]" aria-hidden>
                🔍
              </span>
              <input
                className={`w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-2 text-sm outline-none focus:border-zinc-400 sm:pl-9 sm:pr-3 sm:text-sm ${
                  fillViewport ? "min-h-[36px] py-1.5 text-xs" : "min-h-[44px] py-2 text-base"
                }`}
                placeholder="検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="プロジェクトを検索"
              />
            </label>
            <button
              type="button"
              disabled={!hasSession}
              title={!hasSession ? "ログインが必要です" : "通知"}
              onClick={() => {
                if (!hasSession) return;
                setInviteOpen(true);
              }}
              className={`relative inline-flex shrink-0 touch-manipulation items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 ${
                fillViewport ? "min-h-[36px] min-w-[36px]" : "min-h-[44px] min-w-[44px]"
              }`}
              aria-label="通知"
            >
              <Bell className={fillViewport ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.75} aria-hidden />
              {bellBadge > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                  {bellBadge > 9 ? "9+" : bellBadge}
                </span>
              ) : null}
            </button>
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
              <span className="sr-only sm:not-sr-only">並び</span>
              <select
                className={`rounded-lg border border-zinc-200 bg-white text-zinc-800 ${fillViewport ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="並び順"
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="name">名前</option>
              </select>
            </label>
          </div>
        </header>

        {err ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <p className="text-sm text-rose-600">{err}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700"
              onClick={() => void load()}
            >
              再読み込み
            </button>
          </div>
        ) : null}
        {inviteToast ? <p className="px-4 py-1 text-center text-xs font-medium text-emerald-700">{inviteToast}</p> : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            fillViewport ? "relative min-h-0 p-0" : "mobile-content-inset px-1 pt-1 pb-2 sm:px-2"
          }`}
        >
          {!fillViewport && currentUserId ? (
            <div className="mb-2 shrink-0">
              <ActiveProjectCard userId={currentUserId} />
            </div>
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col">
            <ProjectCubeCarousel
              projects={displayList}
              currentUserId={currentUserId}
              joinedIds={joinedIds}
              loading={loading}
              onCreate={() => setCreateOpen(true)}
            />
          </div>

          {!loading && displayList.length === 0 ? (
            <div className="mt-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">参加しているプロジェクトはまだありません。</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                自分で作るか、「探す」タブから公開プロジェクトに応募してみましょう。キューブの「新規」面からも作成できます。
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
                  onClick={() => setCreateOpen(true)}
                >
                  プロジェクトを作る
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                  onClick={() => {
                    onNavigate("chat");
                  }}
                >
                  探すタブで応募する
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setCreateOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">新規プロジェクト</h3>
              <button type="button" className="text-sm text-zinc-500" onClick={() => setCreateOpen(false)}>閉じる</button>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                placeholder="名前 *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <textarea
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                rows={2}
                placeholder="一言説明"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-700">プロジェクトの系統</p>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  ロードマップのテンプレートが変わります。途中から変更もできます。
                </p>
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
                            ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
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
                <option value="public">公開</option>
                <option value="private">非公開</option>
              </select>
              <button
                type="button"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-600"
                onClick={() => setShowAdvancedFields((prev) => !prev)}
              >
                {showAdvancedFields ? "詳細設定を閉じる" : "詳細設定（任意）を開く"}
              </button>
              {showAdvancedFields ? (
                <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2">
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="カテゴリ（任意）"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="タグ（任意・カンマ区切り）"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="募集したい人（任意）"
                    value={form.recruitment_target}
                    onChange={(e) => setForm((f) => ({ ...f, recruitment_target: e.target.value }))}
                  />
                  <textarea
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="募集文（任意）"
                    value={form.recruitment_message}
                    onChange={(e) => setForm((f) => ({ ...f, recruitment_message: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="サムネURL（任意）"
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
              {busy ? "作成中…" : "作成して開く"}
            </button>
          </div>
        </div>
      ) : null}

      {inviteOpen && currentUserId ? (
        <ProjectInviteBellPanel
          open={inviteOpen}
          onClose={() => {
            setInviteOpen(false);
            void refreshBellBadge(currentUserId);
          }}
          userId={currentUserId}
          eligibleProjects={inviteEligibleProjects}
          onAccepted={() => void load()}
          toast={flashInviteToast}
        />
      ) : null}
    </div>
  );
}
