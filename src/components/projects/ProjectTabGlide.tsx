"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildRoadmapTemplateRows, PROJECT_LINE_META } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { copyProjectInviteUrl, shareOrCopyProject } from "@/lib/projects/inviteLink";

export type AppFeatureKey = "projects" | "posts" | "articles" | "mentor" | "discovery" | "chat" | "account";

type SortKey = "newest" | "oldest" | "name";

type Props = {
  displayName: string;
  sessionEmail: string | null;
  hasSession: boolean;
  onNavigate: (key: AppFeatureKey) => void;
  /** /projects など全画面表示向け */
  fillViewport?: boolean;
};

const ProjectCubeCarousel = dynamic(
  () => import("@/components/projects/ProjectCubeCarousel").then((m) => m.ProjectCubeCarousel),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-full min-h-0 w-full flex-1" aria-busy>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#f4f4f5_0%,#ffffff_70%)]">
          <div className="h-[min(48vmin,420px)] w-[min(48vmin,420px)] animate-pulse rounded-3xl bg-zinc-200/70" />
          <p className="mt-4 text-xs text-zinc-400">3Dを準備中…</p>
        </div>
      </div>
    ),
  },
);

/** 一覧用の列のみ。`select *` + order で RLS が重く statement timeout になりやすいため分割取得する */
const PROJECT_LIST_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ProjectTabGlide({ displayName: _displayName, sessionEmail: _sessionEmail, hasSession, onNavigate, fillViewport = false }: Props) {
  void _displayName;
  void _sessionEmail;
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

  const flashInviteToast = useCallback((message: string) => {
    setInviteToast(message);
    window.setTimeout(() => setInviteToast(""), 2600);
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
      const { data: session } = await client.auth.getSession();
      const uid = session?.session?.user.id;
      if (!uid) {
        setCurrentUserId(null);
        setProjects([]);
        setJoinedIds(new Set());
        return;
      }
      setCurrentUserId(uid);

      const { data: mems, error: memErr } = await client.from("project_members").select("project_id").eq("user_id", uid);
      if (memErr) {
        setErr(memErr.message);
        return;
      }
      const memberIds = [...new Set((mems ?? []).map((m: { project_id: string }) => m.project_id))];

      let memberRows: ProjectRow[] = [];
      if (memberIds.length > 0) {
        const batches = chunkIds(memberIds, 90);
        const batchResults = await Promise.all(
          batches.map((batch) => client.from("projects").select(PROJECT_LIST_SELECT).in("id", batch)),
        );
        for (const br of batchResults) {
          if (br.error) {
            setErr(br.error.message);
            return;
          }
          memberRows = memberRows.concat((br.data ?? []) as ProjectRow[]);
        }
      }

      const { data: ownedFallback, error: ownErr } = await client
        .from("projects")
        .select(PROJECT_LIST_SELECT)
        .eq("owner_id", uid)
        .order("updated_at", { ascending: false })
        .limit(120);
      if (ownErr) {
        setErr(ownErr.message);
        return;
      }

      const byId = new Map<string, ProjectRow>();
      for (const row of [...memberRows, ...((ownedFallback ?? []) as ProjectRow[])]) {
        byId.set(row.id, row);
      }
      const merged = [...byId.values()].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setProjects(merged.slice(0, 200));
      setJoinedIds(new Set(merged.map((p) => p.id)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
            <h2
              className={`font-bold tracking-tight text-zinc-900 ${
                fillViewport ? "text-base sm:text-lg" : "text-xl sm:text-2xl"
              }`}
            >
              マイプロジェクト
            </h2>
            {fillViewport ? null : (
              <p className="mt-0.5 text-[11px] text-zinc-500">参加中のプロジェクトだけ表示されます</p>
            )}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:flex-initial sm:min-w-0 sm:gap-2">
            <label className={`relative min-w-0 flex-1 ${fillViewport ? "max-w-[9.5rem] sm:max-w-xs" : "sm:max-w-xs"}`}>
              <span
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] leading-none sm:left-3 sm:text-[15px]"
                aria-hidden
              >
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
              disabled={!hasSession || inviteEligibleProjects.length === 0}
              title={
                !hasSession
                  ? "ログインが必要です"
                  : inviteEligibleProjects.length === 0
                    ? "参加中または自分がオーナーのプロジェクトだけ招待リンクを出せます"
                    : "参加中・オーナーのプロジェクトのURLをコピー・共有"
              }
              onClick={() => {
                if (!hasSession || inviteEligibleProjects.length === 0) return;
                setInviteOpen(true);
              }}
              className={`relative inline-flex shrink-0 touch-manipulation items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                fillViewport ? "min-h-[36px] min-w-[36px] px-2 text-xs font-semibold" : "min-h-[44px] px-3 text-sm font-semibold"
              } text-zinc-800`}
            >
              招待
            </button>
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
              <span className="sr-only sm:not-sr-only">並び</span>
              <select
                className={`rounded-lg border border-zinc-200 bg-white text-zinc-800 ${
                  fillViewport ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
                }`}
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
            fillViewport ? "relative min-h-0 p-0" : "px-1 pt-1 pb-2 sm:px-2"
          }`}
        >
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

      {inviteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={() => setInviteOpen(false)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-zinc-900">招待リンク</h3>
              <button type="button" className="text-sm text-zinc-500" onClick={() => setInviteOpen(false)}>
                閉じる
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              表示されているのは、あなたが<strong>参加中</strong>か<strong>オーナー</strong>のプロジェクトだけです。URL を LINE やメールで送れます（相手が開ける条件は公開設定やメンバー状態によります）。
            </p>
            <ul className="mt-4 space-y-2">
              {inviteEligibleProjects.map((p) => (
                <li key={p.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                  <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                  <p className="text-[11px] text-zinc-500">{p.visibility === "public" ? "公開" : "非公開"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() =>
                        void (async () => {
                          const ok = await copyProjectInviteUrl(p.id);
                          flashInviteToast(ok ? `「${p.name}」のURLをコピーしました` : "コピーに失敗しました");
                        })()
                      }
                    >
                      URLをコピー
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800"
                      onClick={() =>
                        void (async () => {
                          const r = await shareOrCopyProject(p.name, p.id);
                          if (r === "failed") flashInviteToast("共有できませんでした");
                          else if (r === "copied") flashInviteToast("テキストをコピーしました（共有メニューなし）");
                          else flashInviteToast("共有パネルを開きました");
                        })()
                      }
                    >
                      共有…
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
