"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildRoadmapTemplateRows, PROJECT_LINE_META, projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { copyProjectInviteUrl, shareOrCopyProject } from "@/lib/projects/inviteLink";

export type AppFeatureKey = "projects" | "posts" | "articles" | "mentor" | "discovery" | "chat" | "account";

type SortKey = "newest" | "oldest" | "name";

const ICON_BG = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

type Props = {
  displayName: string;
  sessionEmail: string | null;
  hasSession: boolean;
  onNavigate: (key: AppFeatureKey) => void;
};

const sidebarItems: { key: AppFeatureKey; label: string; icon: string }[] = [
  { key: "posts", label: "ホーム", icon: "⌂" },
  { key: "projects", label: "プロジェクト", icon: "▦" },
  { key: "chat", label: "検索", icon: "⌕" },
  { key: "account", label: "プロフィール", icon: "◉" },
];

function hashIndex(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** 一覧用の列のみ。`select *` + order で RLS が重く statement timeout になりやすいため分割取得する */
const PROJECT_LIST_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ProjectTabGlide({ displayName, sessionEmail, hasSession, onNavigate }: Props) {
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
    <div className="flex min-h-[min(72vh,720px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 shadow-sm sm:flex-row">
      {/* サイドバー：Glide風（md+） */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-b border-zinc-200 bg-white sm:border-b-0 sm:border-r md:flex">
        <div className="border-b border-zinc-100 p-3">
          <p className="text-xs font-medium text-zinc-500">Free</p>
          <p className="truncate text-sm font-semibold text-zinc-900">{displayName.trim() || "moni"}</p>
          <p className="truncate text-[11px] text-zinc-400">{sessionEmail ?? ""}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onNavigate(item.key);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
                item.key === "projects" ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-3 sm:px-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">マイプロジェクト</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">参加中のプロジェクトだけ表示されます</p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial sm:min-w-0">
            <input
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:max-w-xs"
              placeholder="検索 ⌘K 風"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="プロジェクトを検索"
            />
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
              className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              招待リンク
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-zinc-100 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>並び</span>
            <select
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="name">名前</option>
            </select>
          </div>
        </div>

        {err ? <p className="px-4 py-2 text-sm text-rose-600">{err}</p> : null}
        {inviteToast ? <p className="px-4 py-1 text-center text-xs font-medium text-emerald-700">{inviteToast}</p> : null}

        <div className="p-3 pb-28 sm:p-4 sm:pb-24">
          {loading ? <p className="text-sm text-zinc-500">読み込み中…</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* 新規カード（Glide の +） */}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/80 transition hover:border-zinc-300 hover:bg-zinc-100/80"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-2xl font-light text-white shadow-sm transition group-hover:scale-105">+</span>
              <span className="text-sm font-semibold text-zinc-800">新規プロジェクト</span>
              <span className="text-center text-[11px] text-zinc-500">作って仲間を集める</span>
            </button>

            {displayList.map((p) => {
              const c = ICON_BG[hashIndex(p.id, ICON_BG.length)];
              return (
                <div key={p.id} className="group relative">
                  <Link
                    href={`/projects/${p.id}/overview`}
                    prefetch
                    className="relative z-10 flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-white px-2 py-3 text-center shadow-md transition hover:shadow-lg active:opacity-90"
                  >
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${c} text-2xl text-white shadow-sm`} aria-hidden>
                      {(p.name.trim().charAt(0) || "P").toUpperCase()}
                    </div>
                    <p className="line-clamp-2 w-full text-sm font-semibold text-zinc-900">{p.name}</p>
                    <p className="line-clamp-1 w-full text-[10px] font-semibold text-indigo-800">{projectLineShortLabel(p.business_type)}</p>
                    <p className="line-clamp-1 w-full text-[11px] text-zinc-500">
                      {p.visibility === "public" ? "公開" : "非公開"}
                      {currentUserId && p.owner_id === currentUserId ? " ・ オーナー" : ""}
                      {joinedIds.has(p.id) ? " ・ メンバー" : ""}
                    </p>
                    <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded bg-white/90 px-1.5 text-[10px] text-zinc-500">⋯</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {!loading && displayList.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-zinc-800">参加しているプロジェクトはまだありません。</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                自分で作るか、「探す」タブから公開プロジェクトに応募してみましょう。
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
                  className="min-h-[44px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700"
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

        {/* フローティング風 CTA（簡易版） */}
        <div className="sticky bottom-0 border-t border-zinc-100 bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
          <div className="mx-auto flex max-w-lg flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:pr-1">
            <p className="pl-1 text-xs text-zinc-500 sm:flex-1">次の一手は、コミュニティで進捗共有か質問相談。</p>
            <button
              type="button"
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white"
              onClick={() => onNavigate("posts")}
            >
              コミュニティへ
            </button>
          </div>
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
