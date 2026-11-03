"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { hasProjectBriefContent, resolveProjectBrief } from "@/lib/projects/projectBrief";
import type { ProjectRow } from "@/lib/projects/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

const PROJECT_SELECT =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,coaching_context,created_at,updated_at";
const PROJECT_SELECT_FALLBACK =
  "id,owner_id,name,description,category,tags,thumbnail_url,visibility,business_type,recruitment_target,recruitment_message,created_at,updated_at";

export type ExploreFriendProjectSeed = {
  id: string;
  name: string;
  description: string;
  visibility: string;
};

type Props = {
  projectId: string;
  /** 一覧カードから渡す要約。フル取得前・失敗時のフォールバック用 */
  seed?: ExploreFriendProjectSeed | null;
  onClose: () => void;
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

function seedAsProject(seed: ExploreFriendProjectSeed): ProjectRow {
  const now = new Date().toISOString();
  return {
    id: seed.id,
    owner_id: "",
    name: seed.name,
    description: seed.description ?? "",
    category: "",
    tags: [],
    thumbnail_url: null,
    visibility: seed.visibility === "private" ? "private" : "public",
    recruitment_target: "",
    recruitment_message: "",
    created_at: now,
    updated_at: now,
  };
}

export function ExploreFriendProjectDetail({ projectId, seed, onClose }: Props) {
  const { tx, locale } = useI18n();
  const [portalReady, setPortalReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsgDraft, setJoinMsgDraft] = useState("");
  const [toast, setToast] = useState("");
  const [fromSeedOnly, setFromSeedOnly] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const applySeedFallback = useCallback(
    (message?: string) => {
      if (seed && seed.id === projectId && seed.visibility === "public") {
        setProject(seedAsProject(seed));
        setFromSeedOnly(true);
        setOwnerName(tx("オーナー", "Owner"));
        setError("");
        return true;
      }
      if (seed && seed.id === projectId && seed.visibility === "private") {
        setError(
          tx(
            "このプロジェクトは非公開です。詳細はメンバーのみ閲覧できます。",
            "This project is private. Only members can view details.",
          ),
        );
        setProject(null);
        return true;
      }
      if (message) setError(message);
      setProject(null);
      return false;
    },
    [projectId, seed, tx],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setFromSeedOnly(false);

    if (!supabase) {
      applySeedFallback(tx("接続設定が見つかりません。", "Connection settings not found."));
      setLoading(false);
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user.id ?? null;
      setUid(userId);

      const primary = await supabase.from("projects").select(PROJECT_SELECT).eq("id", projectId).maybeSingle();
      let row: ProjectRow | null = null;
      if (primary.error) {
        const msg = primary.error.message ?? "";
        const schemaMismatch =
          primary.error.code === "42703" ||
          primary.error.code === "PGRST204" ||
          msg.includes("does not exist") ||
          msg.includes("schema cache");
        if (!schemaMismatch) {
          applySeedFallback(tx("プロジェクトを読み込めませんでした。", "Couldn’t load this project."));
          return;
        }
        const fallback = await supabase
          .from("projects")
          .select(PROJECT_SELECT_FALLBACK)
          .eq("id", projectId)
          .maybeSingle();
        if (fallback.error || !fallback.data) {
          applySeedFallback(tx("プロジェクトを読み込めませんでした。", "Couldn’t load this project."));
          return;
        }
        row = fallback.data as ProjectRow;
      } else if (!primary.data) {
        applySeedFallback(tx("プロジェクトが見つかりません。", "Project not found."));
        return;
      } else {
        row = primary.data as ProjectRow;
      }

      // 非公開は参加メンバー以外には詳細を出さない（閲覧のみ対象は公開プロジェクト）
      if (row.visibility !== "public") {
        if (!userId) {
          setError(tx("このプロジェクトは非公開です。", "This project is private."));
          setProject(null);
          return;
        }
        const { data: mem } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .maybeSingle();
        const ownerOk = row.owner_id === userId;
        if (!mem && !ownerOk) {
          setError(
            tx(
              "このプロジェクトは非公開です。詳細はメンバーのみ閲覧できます。",
              "This project is private. Only members can view details.",
            ),
          );
          setProject(null);
          return;
        }
        setIsMember(true);
      } else if (userId) {
        const { data: mem } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .maybeSingle();
        setIsMember(Boolean(mem) || row.owner_id === userId);
        const { data: req } = await supabase
          .from("project_join_requests")
          .select("id")
          .eq("project_id", projectId)
          .eq("requester_id", userId)
          .eq("status", "pending")
          .maybeSingle();
        setJoinPending(Boolean(req));
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", row.owner_id)
        .maybeSingle();
      setOwnerName(((profile?.display_name as string | null) ?? "").trim() || tx("オーナー", "Owner"));
      setProject(row);
      setFromSeedOnly(false);
    } finally {
      setLoading(false);
    }
  }, [applySeedFallback, projectId, tx]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitJoin() {
    if (!supabase || !uid || !project) {
      setToast(tx("ログインが必要です。", "Please sign in."));
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    setJoinBusy(true);
    setToast("");
    try {
      const { error: insertErr } = await supabase.from("project_join_requests").insert({
        project_id: project.id,
        requester_id: uid,
        message: joinMsgDraft.trim() || tx("参加したいです", "I'd like to join"),
      });
      if (insertErr) {
        setToast(insertErr.message);
        return;
      }
      setJoinPending(true);
      setJoinMsgDraft("");
      setToast(tx("参加申請を送信しました。", "Join request sent."));
      window.setTimeout(() => setToast(""), 2800);
    } finally {
      setJoinBusy(false);
    }
  }

  function typeLabel(bt: ProjectRow["business_type"]) {
    if (bt === "maker") return tx("モノづくりタイプ", "Maker");
    if (bt === "software") return tx("ソフトウェアタイプ", "Software");
    if (bt === "social") return tx("社会奉仕タイプ", "Social");
    return tx("タイプ未設定", "Type unset");
  }

  if (!portalReady) return null;

  const toastOk = toast.includes("送信") || toast.toLowerCase().includes("sent");

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-white pt-[env(safe-area-inset-top,0px)] text-zinc-900"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-project-detail-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2.5">
        <button
          type="button"
          className="rounded-full p-2.5 text-lg leading-none text-zinc-700 transition hover:bg-zinc-100"
          onClick={onClose}
          aria-label={tx("戻る", "Back")}
        >
          ←
        </button>
        <h3 id="friend-project-detail-title" className="text-sm font-semibold text-zinc-900">
          {tx("プロジェクト詳細", "Project details")}
        </h3>
        <span className="w-11 shrink-0" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-4">
          {loading ? (
            <p className="py-16 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
          ) : error ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
              <p className="text-sm font-medium text-zinc-700">{error}</p>
              <p className="mt-2 text-[12px] text-zinc-500">
                {tx("公開プロジェクトのみ詳細を閲覧できます。", "Only public projects can be viewed in detail.")}
              </p>
            </div>
          ) : project ? (
            <>
              <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                  {project.thumbnail_url?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.thumbnail_url.trim()}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center text-3xl text-white ${PROJECT_ICON_BG[projectHashIndex(project.id, PROJECT_ICON_BG.length)]}`}
                    >
                      {(project.name.trim().charAt(0) || "P").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{typeLabel(project.business_type ?? null)}</p>
                  {project.category?.trim() ? (
                    <p className="mt-1.5 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      {project.category}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-700">
                    {tx("閲覧のみ", "View only")}
                  </p>
                </div>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                {(() => {
                  const brief = resolveProjectBrief({
                    coachingContext: project.coaching_context,
                    description: project.description,
                  });
                  if (hasProjectBriefContent(brief)) {
                    return (
                      <>
                        {brief.problemMotivation ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                              {tx(
                                "どのようなことを解決したくて思いついたか",
                                "What problem sparked this project",
                              )}
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                              {brief.problemMotivation}
                            </dd>
                          </div>
                        ) : null}
                        {brief.projectGoal ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                              {tx("このプロジェクトのゴール", "Project goal")}
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                              {brief.projectGoal}
                            </dd>
                          </div>
                        ) : null}
                        {brief.whatToDo ? (
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                              {tx("何をするのか", "What we’ll do")}
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                              {brief.whatToDo}
                            </dd>
                          </div>
                        ) : null}
                      </>
                    );
                  }
                  return (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        {tx("説明", "Description")}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                        {project.description?.trim() || tx("未設定", "Not set")}
                      </dd>
                    </div>
                  );
                })()}
                {!fromSeedOnly ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {tx("発足", "Launched")}
                    </dt>
                    <dd className="mt-1 text-zinc-800">{formatLaunchedAt(project.created_at, locale)}</dd>
                  </div>
                ) : null}
                {!fromSeedOnly || ownerName ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {tx("オーナー", "Owner")}
                    </dt>
                    <dd className="mt-1 text-zinc-800">{ownerName || tx("オーナー", "Owner")}</dd>
                  </div>
                ) : null}
                {!fromSeedOnly ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {tx("欲しい仲間・姿勢", "Who we’re looking for")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                      {project.recruitment_target?.trim() || tx("未設定", "Not set")}
                    </dd>
                  </div>
                ) : null}
                {!fromSeedOnly && (project.recruitment_message ?? "").trim() ? (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      {tx("理念・ビジョン", "Vision")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-800">
                      {project.recruitment_message}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-center text-[12px] leading-relaxed text-zinc-500">
                {isMember
                  ? tx(
                      "あなたはこのプロジェクトのメンバーです。中身の編集はプロジェクト画面から行えます。",
                      "You’re a member. Open the project workspace to edit.",
                    )
                  : tx(
                      "ここからは説明と募集内容のみ確認できます（閲覧のみ）。中身を見るには参加申請が承認される必要があります。",
                      "Here you can only view the description and recruitment (view only). Join and get approved to open the project.",
                    )}
              </p>
              {toast ? (
                <p className={`mt-3 text-center text-xs font-medium ${toastOk ? "text-emerald-700" : "text-rose-600"}`}>
                  {toast}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {project && project.visibility === "public" && !isMember && !fromSeedOnly ? (
          <div className="shrink-0 border-t border-zinc-200 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
            {uid ? (
              joinPending ? (
                <p className="py-2 text-center text-sm font-medium text-amber-800">
                  {tx("参加申請済みです", "Join request already sent")}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                    rows={2}
                    placeholder={tx("参加申請のメッセージ（任意）", "Message with your request (optional)")}
                    value={joinMsgDraft}
                    onChange={(e) => setJoinMsgDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={joinBusy}
                    onClick={() => void submitJoin()}
                    className="min-h-[44px] rounded-xl border border-sky-600 bg-sky-50 text-sm font-semibold text-sky-900 disabled:opacity-50"
                  >
                    {joinBusy ? tx("送信中…", "Sending…") : tx("参加申請を送る", "Send join request")}
                  </button>
                </div>
              )
            ) : (
              <p className="py-2 text-center text-xs text-zinc-500">
                {tx("参加申請にはログインが必要です", "Sign in to send a join request")}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
