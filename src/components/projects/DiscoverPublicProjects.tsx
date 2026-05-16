"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectRow } from "@/lib/projects/types";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { businessTypeLabelJa, projectLineShortLabel } from "@/lib/projects/roadmapTemplates";

const PROJECT_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

type Props = {
  showSectionHeader?: boolean;
};

function formatLaunchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export function DiscoverPublicProjects({ showSectionHeader = true }: Props) {
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
          nameMap[p.id as string] = ((p.display_name as string | null) ?? "").trim() || "オーナー";
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
  }, []);

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
      setToast("ログインが必要です。");
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    setBusyId(projectId);
    setToast("");
    try {
      const { error } = await supabase.from("project_join_requests").insert({
        project_id: projectId,
        requester_id: uid,
        message: joinMsgDraft.trim() || "参加したいです",
      });
      if (error) {
        setToast(error.message);
        return;
      }
      setPendingIds((prev) => new Set(prev).add(projectId));
      setDetailProject(null);
      setJoinMsgDraft("");
      setToast("参加申請を送信しました。");
      window.setTimeout(() => setToast(""), 2800);
    } finally {
      setBusyId(null);
    }
  }

  if (!supabase) return null;

  const detail = detailProject;
  const detailPending = detail ? pendingIds.has(detail.id) : false;
  const detailBusy = detail ? busyId === detail.id : false;

  return (
    <div>
      {showSectionHeader ? (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-zinc-900">プロジェクトを探す</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            参加していない公開プロジェクトだけ表示。カードをタップして詳細を見られます。
          </p>
        </div>
      ) : null}

      <input
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
        placeholder="名前・説明・カテゴリで検索…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="公開プロジェクトを検索"
      />

      {toast ? (
        <p className={`mt-2 text-xs font-medium ${toast.includes("送信") ? "text-emerald-700" : "text-rose-600"}`}>{toast}</p>
      ) : null}

      <div className="mt-3">
        {loading ? <p className="py-8 text-center text-sm text-zinc-500">読み込み中…</p> : null}
        {!loading && browseList.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
            {uid ? "応募できる公開プロジェクトはありません。" : "ログインすると公開プロジェクトに応募できます。"}
          </p>
        ) : null}
        {!loading && browseList.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {browseList.map((p) => {
              const c = PROJECT_ICON_BG[projectHashIndex(p.id, PROJECT_ICON_BG.length)];
              const thumb = p.thumbnail_url?.trim();
              return (
                <button
                  key={p.id}
                  type="button"
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-zinc-200/90 bg-white px-2 py-3 text-center shadow-md transition hover:border-zinc-300 hover:shadow-lg active:scale-[0.98]"
                  onClick={() => {
                    setDetailProject(p);
                    setJoinMsgDraft("");
                  }}
                >
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-100">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className={`flex h-full w-full items-center justify-center text-2xl text-white ${c}`}>
                        {(p.name.trim().charAt(0) || "P").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 w-full text-sm font-semibold text-zinc-900">{p.name}</p>
                  <p className="line-clamp-1 w-full text-[10px] font-semibold text-indigo-800">
                    {projectLineShortLabel(p.business_type)}
                  </p>
                </button>
              );
            })}
          </div>
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
                プロジェクト詳細
              </h3>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
                onClick={() => setDetailProject(null)}
              >
                閉じる
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
                  <p className="mt-0.5 text-xs text-zinc-500">{businessTypeLabelJa(detail.business_type ?? null)}</p>
                  {detail.category?.trim() ? (
                    <p className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {detail.category}
                    </p>
                  ) : null}
                </div>
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">説明</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                    {detail.description?.trim() || "未設定"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">発足</dt>
                  <dd className="mt-1 text-zinc-800">{formatLaunchedAt(detail.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">オーナー</dt>
                  <dd className="mt-1 text-zinc-800">{ownerNames[detail.owner_id] ?? "オーナー"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">欲しい仲間・姿勢</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                    {detail.recruitment_target?.trim() || "未設定"}
                  </dd>
                </div>
                {(detail.recruitment_message ?? "").trim() ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">理念・ビジョン</dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">{detail.recruitment_message}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/projects/${detail.id}/overview`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
                >
                  プロジェクト画面を開く
                </Link>
                {uid ? (
                  detailPending ? (
                    <p className="text-center text-sm font-medium text-amber-800">参加申請済みです</p>
                  ) : (
                    <>
                      <textarea
                        className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                        rows={2}
                        placeholder="参加申請のメッセージ（任意）"
                        value={joinMsgDraft}
                        onChange={(e) => setJoinMsgDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={detailBusy}
                        onClick={() => void submitJoin(detail.id)}
                        className="min-h-[44px] rounded-xl border border-sky-600 bg-sky-50 text-sm font-semibold text-sky-900 disabled:opacity-50"
                      >
                        {detailBusy ? "送信中…" : "参加申請を送る"}
                      </button>
                    </>
                  )
                ) : (
                  <p className="text-center text-xs text-zinc-500">参加申請にはログインが必要です</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
