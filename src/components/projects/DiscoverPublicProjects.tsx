"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectRow } from "@/lib/projects/types";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { useI18n } from "@/lib/i18n/I18nProvider";

const PROJECT_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

type Props = {
  showSectionHeader?: boolean;
};

function formatLaunchedAt(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const SEARCH_EXAMPLES = [
  { q: "マーケ", ja: "マーケ", en: "Marketing" },
  { q: "アプリ", ja: "アプリ", en: "App" },
  { q: "教育", ja: "教育", en: "Education" },
  { q: "デザイン", ja: "デザイン", en: "Design" },
] as const;

export function DiscoverPublicProjects({ showSectionHeader = true }: Props) {
  const { tx, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [detailProject, setDetailProject] = useState<ProjectRow | null>(null);
  const [joinMsgDraft, setJoinMsgDraft] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user.id ?? null;
      setUid(userId);

      const pubRes = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(80);

      if (pubRes.error) {
        setProjects([]);
        return;
      }

      const rows = (pubRes.data ?? []) as ProjectRow[];
      const ownerIds = [...new Set(rows.map((p) => p.owner_id))];
      const nameMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id,display_name").in("id", ownerIds);
        for (const p of profiles ?? []) {
          nameMap[p.id as string] = ((p.display_name as string | null) ?? "").trim() || tx("オーナー", "Owner");
        }
      }
      setOwnerNames(nameMap);

      let memSet = new Set<string>();
      let pendSet = new Set<string>();

      if (userId) {
        const { data: mems } = await supabase.from("project_members").select("project_id").eq("user_id", userId);
        memSet = new Set((mems ?? []).map((m: { project_id: string }) => m.project_id));

        const { data: reqs } = await supabase
          .from("project_join_requests")
          .select("project_id")
          .eq("requester_id", userId)
          .eq("status", "pending");
        pendSet = new Set((reqs ?? []).map((r: { project_id: string }) => r.project_id));
      }

      setMemberIds(memSet);
      setPendingIds(pendSet);
      setProjects(rows);
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const browseList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (memberIds.has(p.id)) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""} ${(p.tags ?? []).join(" ")} ${p.recruitment_target ?? ""}`;
      return hay.toLowerCase().includes(q);
    });
  }, [projects, memberIds, query]);

  async function submitJoin(projectId: string) {
    if (!supabase || !uid) {
      setToast(tx("ログインが必要です。", "Please sign in."));
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    setBusyId(projectId);
    setToast("");
    try {
      const { error } = await supabase.from("project_join_requests").insert({
        project_id: projectId,
        requester_id: uid,
        message: joinMsgDraft.trim() || tx("参加したいです", "I'd like to join"),
      });
      if (error) {
        setToast(error.message);
        return;
      }
      setPendingIds((prev) => new Set(prev).add(projectId));
      setDetailProject(null);
      setJoinMsgDraft("");
      setToast(tx("参加申請を送信しました。", "Join request sent."));
      window.setTimeout(() => setToast(""), 2800);
    } finally {
      setBusyId(null);
    }
  }

  if (!supabase) return null;

  const detail = detailProject;
  const detailPending = detail ? pendingIds.has(detail.id) : false;
  const detailBusy = detail ? busyId === detail.id : false;
  const toastOk = toast.includes("送信") || toast.toLowerCase().includes("sent");

  function typeLabel(bt: ProjectRow["business_type"]) {
    if (bt === "maker") return tx("モノづくりタイプ", "Maker");
    if (bt === "software") return tx("ソフトウェアタイプ", "Software");
    if (bt === "social") return tx("社会奉仕タイプ", "Social");
    return tx("タイプ未設定", "Type unset");
  }

  function lineLabel(bt: ProjectRow["business_type"]) {
    if (bt === "maker") return tx("ものづくり・実験系", "Making & experiments");
    if (bt === "software") return tx("アプリ・デジタル系", "Apps & digital");
    if (bt === "social") return tx("社会・地域・奉仕系", "Social & community");
    return tx("系統未設定", "Uncategorized");
  }

  return (
    <div>
      {showSectionHeader ? (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-zinc-900">{tx("プロジェクトを探す", "Discover projects")}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            {tx(
              "参加していない公開プロジェクトだけ表示。カードをタップして詳細を見られます。",
              "Shows public projects you haven’t joined. Tap a card for details.",
            )}
          </p>
        </div>
      ) : null}

      <input
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
        placeholder={tx("名前・説明・カテゴリで検索…", "Search by name, description, or category…")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={tx("公開プロジェクトを検索", "Search public projects")}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SEARCH_EXAMPLES.map((example) => (
          <button
            key={example.q}
            type="button"
            onClick={() => setQuery(example.q)}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            {locale === "en" ? example.en : example.ja}
          </button>
        ))}
      </div>

      {toast ? (
        <p className={`mt-2 text-xs font-medium ${toastOk ? "text-emerald-700" : "text-rose-600"}`}>{toast}</p>
      ) : null}

      <div className="mt-3">
        {!loading && browseList.length > 0 && !query.trim() ? (
          <p className="mb-2 text-[12px] font-semibold text-zinc-500">
            {tx("注目のプロジェクト（最近更新）", "Featured projects (recently updated)")}
          </p>
        ) : null}
        {!loading && browseList.length > 0 && query.trim() ? (
          <p className="mb-2 text-[12px] font-semibold text-zinc-500">
            {tx(`${browseList.length}件見つかりました`, `${browseList.length} found`)}
          </p>
        ) : null}
        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
        ) : null}
        {!loading && browseList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {query.trim()
                ? tx("条件に合う公開プロジェクトはありません。", "No public projects match your search.")
                : uid
                  ? tx("まだおすすめが少ないです。検索して探してみましょう。", "Few recommendations yet. Try searching.")
                  : tx("ログインすると公開プロジェクトに応募できます。", "Sign in to apply to public projects.")}
            </p>
            {!query.trim() ? (
              <p className="mt-2 text-[12px] text-zinc-500">
                {tx(
                  "例:「マーケ」「アプリ」「教育」をタップしてみてください",
                  "Try tapping “Marketing”, “App”, or “Education”",
                )}
              </p>
            ) : null}
          </div>
        ) : null}
        {!loading && browseList.length > 0 ? (
          <ul className="space-y-2.5">
            {browseList.map((p) => {
              const c = PROJECT_ICON_BG[projectHashIndex(p.id, PROJECT_ICON_BG.length)];
              const thumb = p.thumbnail_url?.trim();
              const recruiting = Boolean(p.recruitment_target?.trim() || p.recruitment_message?.trim());
              const tags = [
                lineLabel(p.business_type),
                p.category?.trim() || null,
                ...(p.tags ?? []).slice(0, 2),
              ].filter(Boolean) as string[];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left shadow-sm shadow-zinc-900/[0.03] transition hover:border-zinc-300 hover:bg-zinc-50/80 active:scale-[0.995]"
                    onClick={() => {
                      setDetailProject(p);
                      setJoinMsgDraft("");
                    }}
                  >
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-zinc-100">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className={`flex h-full w-full items-center justify-center text-lg text-white ${c}`}>
                          {(p.name.trim().charAt(0) || "P").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold text-zinc-900">{p.name}</span>
                        {recruiting ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {tx("仲間募集", "Recruiting")}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                            {tx("公開中", "Public")}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                        {p.description?.trim() || p.recruitment_target?.trim() || tx("まだ説明がありません", "No description yet")}
                      </span>
                      {tags.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <span
                              key={`${p.id}-${tag}`}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-detail-title"
          onClick={() => setDetailProject(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
              <h3 id="project-detail-title" className="text-base font-bold text-zinc-900">
                {tx("プロジェクト詳細", "Project details")}
              </h3>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
                onClick={() => setDetailProject(null)}
              >
                {tx("閉じる", "Close")}
              </button>
            </div>

            <div className="p-4">
              <div className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                  {detail.thumbnail_url?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.thumbnail_url.trim()} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center text-2xl text-white ${PROJECT_ICON_BG[projectHashIndex(detail.id, PROJECT_ICON_BG.length)]}`}
                    >
                      {(detail.name.trim().charAt(0) || "P").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-zinc-900">{detail.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{typeLabel(detail.business_type ?? null)}</p>
                  {detail.category?.trim() ? (
                    <p className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {detail.category}
                    </p>
                  ) : null}
                </div>
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {tx("説明", "Description")}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                    {detail.description?.trim() || tx("未設定", "Not set")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {tx("発足", "Launched")}
                  </dt>
                  <dd className="mt-1 text-zinc-800">{formatLaunchedAt(detail.created_at, locale)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {tx("オーナー", "Owner")}
                  </dt>
                  <dd className="mt-1 text-zinc-800">{ownerNames[detail.owner_id] ?? tx("オーナー", "Owner")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {tx("欲しい仲間・姿勢", "Who we’re looking for")}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                    {detail.recruitment_target?.trim() || tx("未設定", "Not set")}
                  </dd>
                </div>
                {(detail.recruitment_message ?? "").trim() ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {tx("理念・ビジョン", "Vision")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">{detail.recruitment_message}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/projects/${detail.id}/overview`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
                >
                  {tx("プロジェクト画面を開く", "Open project")}
                </Link>
                {uid ? (
                  detailPending ? (
                    <p className="text-center text-sm font-medium text-amber-800">
                      {tx("参加申請済みです", "Join request already sent")}
                    </p>
                  ) : (
                    <>
                      <textarea
                        className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                        rows={2}
                        placeholder={tx("参加申請のメッセージ（任意）", "Message with your request (optional)")}
                        value={joinMsgDraft}
                        onChange={(e) => setJoinMsgDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={detailBusy}
                        onClick={() => void submitJoin(detail.id)}
                        className="min-h-[44px] rounded-xl border border-sky-600 bg-sky-50 text-sm font-semibold text-sky-900 disabled:opacity-50"
                      >
                        {detailBusy ? tx("送信中…", "Sending…") : tx("参加申請を送る", "Send join request")}
                      </button>
                    </>
                  )
                ) : (
                  <p className="text-center text-xs text-zinc-500">
                    {tx("参加申請にはログインが必要です", "Sign in to send a join request")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
