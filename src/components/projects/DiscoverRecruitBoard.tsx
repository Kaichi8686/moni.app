"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import {
  listOpenRecruitmentsForDiscover,
  type ProjectRecruitment,
} from "@/lib/projects/projectRecruitments";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

function lineLabel(bt: string | null | undefined, tx: (ja: string, en: string) => string) {
  if (bt === "maker") return tx("ものづくり・実験系", "Making & experiments");
  if (bt === "software") return tx("アプリ・デジタル系", "Apps & digital");
  if (bt === "social") return tx("社会・地域・奉仕系", "Social & community");
  return tx("系統未設定", "Uncategorized");
}

export function DiscoverRecruitBoard() {
  const { tx } = useI18n();
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ProjectRecruitment[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ProjectRecruitment | null>(null);
  const [joinMsgDraft, setJoinMsgDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [fallbackHint, setFallbackHint] = useState(false);

  useEffect(() => {
    setPortalReady(true);
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

      const list = await listOpenRecruitmentsForDiscover(supabase, { limit: 80 });
      setRows(list);
      setFallbackHint(list.length === 0);
    } catch {
      setRows([]);
      setFallbackHint(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const browseList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      const hay = `${r.title} ${r.message} ${r.projectName ?? ""} ${r.skillName}`;
      return hay.toLowerCase().includes(q);
    });
  }, [rows, query]);

  async function submitJoin(projectId: string) {
    if (!supabase || !uid) {
      setToast(tx("ログインが必要です。", "Please sign in."));
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    setBusyId(projectId);
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
      setDetail(null);
      setJoinMsgDraft("");
      setToast(tx("参加申請を送信しました。", "Join request sent."));
      window.setTimeout(() => setToast(""), 2800);
    } finally {
      setBusyId(null);
    }
  }

  if (!supabase) return null;

  return (
    <div className="h-full">
      <form
        className="grid grid-cols-[minmax(0,1fr)_48px] gap-2 sm:grid-cols-[minmax(0,1fr)_112px]"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          className="min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 sm:text-sm"
          placeholder={tx("欲しい人材・キーワードで検索", "Search by talent or keyword")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={tx("募集を検索", "Search open roles")}
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-900 bg-zinc-900 px-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] sm:px-4 sm:text-sm"
          aria-label={tx("絞り込む", "Search")}
        >
          <span className="hidden sm:inline">{tx("絞り込む", "Search")}</span>
          <svg className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
        </button>
      </form>

      {toast ? <p className="mt-2 text-xs font-medium text-emerald-700">{toast}</p> : null}

      <div className="mt-3">
        {!loading && browseList.length > 0 ? (
          <p className="mb-2 text-[12px] font-semibold text-zinc-500">
            {query.trim()
              ? tx(`${browseList.length}件見つかりました`, `${browseList.length} found`)
              : tx("仲間募集中（最近更新）", "Open roles (recently updated)")}
          </p>
        ) : null}
        {loading ? <p className="py-8 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p> : null}
        {!loading && browseList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-700">
              {query.trim()
                ? tx("条件に合う募集はありません。", "No open roles match your search.")
                : tx("まだ公開中の募集がありません。", "No open recruitments yet.")}
            </p>
            <p className="mt-2 text-[12px] text-zinc-500">
              {fallbackHint
                ? tx(
                    "プロジェクトの「募集」から欲しい人材を追加するとここに表示されます。",
                    "Add openings from a project’s Recruit screen to show them here.",
                  )
                : tx("キーワードを変えて探してみてください。", "Try another keyword.")}
            </p>
          </div>
        ) : null}
        {!loading && browseList.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {browseList.map((r) => {
              const c = PROJECT_ICON_BG[projectHashIndex(r.projectId, PROJECT_ICON_BG.length)];
              const thumb = r.projectThumbnailUrl?.trim();
              const isMine = memberIds.has(r.projectId);
              return (
                <li key={r.id} className="min-w-0">
                  <button
                    type="button"
                    className="group flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:opacity-90"
                    onClick={() => {
                      setDetail(r);
                      setJoinMsgDraft("");
                    }}
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <span
                          className={`flex h-full w-full items-center justify-center text-4xl font-semibold text-white sm:text-5xl ${c}`}
                        >
                          {(r.title.trim().charAt(0) || "R").toUpperCase()}
                        </span>
                      )}
                      {isMine ? (
                        <span className="absolute left-2 top-2 rounded-md bg-zinc-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {tx("あなた", "You")}
                        </span>
                      ) : null}
                    </div>
                    <span className="flex w-full min-w-0 flex-col gap-0.5 px-2.5 py-2.5">
                      <span className="line-clamp-2 w-full break-words [overflow-wrap:anywhere] text-[14px] font-semibold leading-snug text-zinc-900 sm:text-[15px]">
                        {r.title}
                      </span>
                      <span className="line-clamp-1 w-full text-[11px] font-medium text-zinc-500">
                        {r.projectName}
                      </span>
                      <span className="line-clamp-1 w-full text-[10px] font-semibold text-indigo-800 sm:text-[11px]">
                        {lineLabel(r.projectBusinessType, tx)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {portalReady && detail
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-white pt-[env(safe-area-inset-top,0px)]"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2.5">
                <button
                  type="button"
                  className="rounded-full p-2.5 text-lg leading-none text-zinc-700 transition hover:bg-zinc-100"
                  onClick={() => setDetail(null)}
                  aria-label={tx("閉じる", "Close")}
                >
                  ←
                </button>
                <h3 className="text-sm font-semibold text-zinc-900">{tx("募集詳細", "Recruitment details")}</h3>
                <span className="w-10" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="text-lg font-semibold text-zinc-950">{detail.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{detail.projectName}</p>
                {detail.message ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{detail.message}</p>
                ) : null}
                <p className="mt-3 text-[12px] text-zinc-500">
                  {[detail.skillName, detail.duration, detail.compensation].filter(Boolean).join(" · ")}
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  {memberIds.has(detail.projectId) ? (
                    <>
                      <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center text-[12px] text-emerald-800">
                        {tx(
                          "これはあなたのプロジェクトの募集です。",
                          "This is your project’s recruitment.",
                        )}
                      </p>
                      <Link
                        href={`/projects/${detail.projectId}/recruit`}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
                        onClick={() => setDetail(null)}
                      >
                        {tx("募集を管理する", "Manage recruitments")}
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-center text-[12px] text-zinc-500">
                        {tx(
                          "参加申請が承認されると、プロジェクトの中身を見られます。",
                          "Once your join request is approved, you can open the project.",
                        )}
                      </p>
                      {uid ? (
                        pendingIds.has(detail.projectId) ? (
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
                              disabled={busyId === detail.projectId}
                              onClick={() => void submitJoin(detail.projectId)}
                              className="min-h-[44px] rounded-xl border border-sky-600 bg-sky-50 text-sm font-semibold text-sky-900 disabled:opacity-50"
                            >
                              {busyId === detail.projectId
                                ? tx("送信中…", "Sending…")
                                : tx("参加申請を送る", "Send join request")}
                            </button>
                          </>
                        )
                      ) : (
                        <p className="text-center text-xs text-zinc-500">
                          {tx("参加申請にはログインが必要です", "Sign in to send a join request")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
