"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  PROJECT_CARD_ICON_BGS,
  hashProjectVisualIndex,
  projectThumbEmoji,
  projectLineShortLabel,
} from "@/lib/projects/cardChrome";
import type { ProjectRow } from "@/lib/projects/types";

const LIST_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

type BrowseProject = Pick<
  ProjectRow,
  | "id"
  | "owner_id"
  | "name"
  | "description"
  | "category"
  | "tags"
  | "thumbnail_url"
  | "visibility"
  | "business_type"
  | "recruitment_target"
  | "recruitment_message"
  | "created_at"
  | "updated_at"
>;

function formatJaDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export function DiscoverPublicProjects({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [projects, setProjects] = useState<BrowseProject[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<BrowseProject | null>(null);
  const [msgDraft, setMsgDraft] = useState("");

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

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
        .select(LIST_SELECT)
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(80);

      if (pubRes.error) {
        setProjects([]);
        return;
      }

      const rows = (pubRes.data ?? []) as BrowseProject[];
      const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ownerIds);
        nameMap = Object.fromEntries(
          (profs ?? []).map((p) => [p.id as string, ((p.display_name as string | null) || "ユーザー").trim() || "ユーザー"]),
        );
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
      const tagStr = (p.tags ?? []).join(" ");
      return `${p.name} ${p.description ?? ""} ${tagStr}`.toLowerCase().includes(q);
    });
  }, [projects, memberIds, query]);

  async function submitJoin(projectId: string) {
    if (!supabase || !uid) {
      showToast("ログインが必要です。");
      return;
    }
    setBusyId(projectId);
    setToast("");
    try {
      const { error } = await supabase.from("project_join_requests").insert({
        project_id: projectId,
        requester_id: uid,
        message: msgDraft.trim() || "参加したいです",
      });
      if (error) {
        showToast(error.message);
        return;
      }
      setPendingIds((prev) => new Set(prev).add(projectId));
      setMsgDraft("");
      showToast("参加申請を送信しました。");
      void load();
    } finally {
      setBusyId(null);
    }
  }

  if (!supabase) return null;

  return (
    <div className={`rounded-2xl border border-[#e5e7eb] bg-white p-3 shadow-sm sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#262626]">公開プロジェクト</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-[#6b7280]">
            まだ参加していない公開プロジェクトです。カードを開いて概要を確認し、応募できます。
          </p>
        </div>
      </div>

      <label className="sr-only" htmlFor="discover-project-query">
        プロジェクト名・説明で検索
      </label>
      <input
        id="discover-project-query"
        className="mt-3 w-full rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 text-sm outline-none focus:border-[#93c5fd]"
        placeholder="名前・タグ・説明で絞り込み…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {toast ? (
        <p
          className={`mt-2 text-xs font-medium ${toast.includes("送信") || toast.includes("しました") ? "text-emerald-700" : "text-rose-600"}`}
          role="status"
        >
          {toast}
        </p>
      ) : null}

      <div className="mt-3">
        {loading ? <p className="py-8 text-center text-sm text-[#6b7280]">読み込み中…</p> : null}
        {!loading && browseList.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-3 py-8 text-center text-sm text-[#6b7280]">
            {uid ? "応募できる公開プロジェクトはありません（すべて参加済みか、検索に一致しません）。" : "ログインすると公開プロジェクトに応募できます。"}
          </p>
        ) : null}

        {!loading && browseList.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {browseList.map((p) => {
              const pending = pendingIds.has(p.id);
              const c = PROJECT_CARD_ICON_BGS[hashProjectVisualIndex(p.id, PROJECT_CARD_ICON_BGS.length)];
              const thumb = (p.thumbnail_url ?? "").trim();
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setDetail(p);
                    setMsgDraft("");
                  }}
                  className="group relative flex aspect-square flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white text-left shadow-md transition hover:shadow-lg active:opacity-95"
                >
                  <div className="relative h-[52%] min-h-0 w-full shrink-0 overflow-hidden bg-zinc-100">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary URL
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center ${c} text-3xl text-white shadow-inner`} aria-hidden>
                        {projectThumbEmoji(p.business_type)}
                      </div>
                    )}
                    {pending ? (
                      <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-950 ring-1 ring-amber-200/80">
                        申請済
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col justify-center px-2 py-2">
                    <p className="line-clamp-2 text-center text-[13px] font-semibold leading-snug text-zinc-900">{p.name}</p>
                    <p className="mt-1 line-clamp-1 text-center text-[10px] font-semibold text-indigo-800">
                      {projectLineShortLabel(p.business_type ?? null)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-center text-[10px] text-zinc-500">
                      {(p.category ?? "").trim() || "探究"}
                      {" · "}
                      {p.visibility === "public" ? "公開" : "非公開"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[min(92dvh,760px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-project-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
              <button type="button" className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50" onClick={() => setDetail(null)}>
                閉じる
              </button>
              <Link
                href={`/projects/${detail.id}`}
                className="text-sm font-semibold text-indigo-700 hover:underline"
                onClick={() => setDetail(null)}
              >
                詳細ページへ
              </Link>
            </div>

            <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
                {(detail.thumbnail_url ?? "").trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(detail.thumbnail_url ?? "").trim()} alt="" className="aspect-[21/9] w-full object-cover sm:aspect-[2/1]" />
                ) : (
                  <div
                    className={`flex aspect-[21/9] w-full items-center justify-center text-5xl sm:aspect-[2/1] ${PROJECT_CARD_ICON_BGS[hashProjectVisualIndex(detail.id, PROJECT_CARD_ICON_BGS.length)]} text-white`}
                  >
                    {projectThumbEmoji(detail.business_type)}
                  </div>
                )}
              </div>

              <div>
                <h2 id="discover-project-detail-title" className="text-xl font-bold tracking-tight text-zinc-900">
                  {detail.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  発足 {formatJaDate(detail.created_at) || "情報なし"}
                  {" · "}
                  更新 {formatJaDate(detail.updated_at) || "—"}
                </p>
              </div>

              <section className="rounded-xl border border-zinc-100 bg-white p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">説明</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                  {(detail.description ?? "").trim() || "未設定"}
                </p>
              </section>

              <section className="rounded-xl border border-zinc-100 bg-white p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">オーナー</h3>
                <p className="mt-2 text-base font-semibold text-zinc-900">{ownerNames[detail.owner_id] ?? "情報なし"}</p>
              </section>

              <section className="rounded-xl border border-zinc-100 bg-white p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">募集したい仲間</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                  {(detail.recruitment_target ?? "").trim() || "未設定"}
                </p>
              </section>

              <section className="rounded-xl border border-zinc-100 bg-white p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">メッセージ</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                  {(detail.recruitment_message ?? "").trim() || "未設定"}
                </p>
              </section>

              {(detail.tags ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(detail.tags ?? []).map((t) => (
                    <span key={`${detail.id}-tag-${t}`} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="border-t border-zinc-100 pt-4">
                {!uid ? (
                  <p className="text-center text-sm text-zinc-500">ログインすると参加申請できます。</p>
                ) : pendingIds.has(detail.id) ? (
                  <p className="text-center text-sm font-semibold text-amber-900">参加申請済みです。承認をお待ちください。</p>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-zinc-700" htmlFor="discover-join-msg">
                      一言メッセージ（任意）
                    </label>
                    <textarea
                      id="discover-join-msg"
                      className="mt-2 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                      rows={3}
                      placeholder="参加したい理由や一言をどうぞ"
                      value={msgDraft}
                      onChange={(e) => setMsgDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={busyId === detail.id}
                      onClick={() => void submitJoin(detail.id)}
                      className="mt-3 w-full min-h-[44px] rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busyId === detail.id ? "送信中…" : "参加申請を送る"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
