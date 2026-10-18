"use client";

import { useCallback, useEffect, useState } from "react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  cancelDeletionProposal,
  castDeletionVote,
  fetchDeletionState,
  type DeletionState,
} from "@/lib/projects/deletionVote";

/**
 * 削除提案が進行中のとき、プロジェクト詳細とロードマップの間に
 * 賛成・反対の人数を常時表示する。
 */
export function ProjectDeletionVoteBanner() {
  const { tx } = useI18n();
  const { projectId, project, uid, isOwner, deleteProject } = useProjectWorkspace();
  const [state, setState] = useState<DeletionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const next = await fetchDeletionState(projectId, uid);
      setState(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Failed to load"));
    }
  }, [projectId, uid, tx]);

  useEffect(() => {
    void reload();
    const t = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(t);
  }, [reload]);

  if (!state?.proposal || !project) return null;

  const projectName = project.name;
  const threshold = Math.ceil((state.memberCount * 2) / 3);

  async function onVote(approve: boolean) {
    if (!uid || !state?.proposal) return;
    setBusy(true);
    try {
      await castDeletionVote(projectId, state.proposal.id, uid, approve);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("投票に失敗しました", "Couldn’t vote"));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!state?.proposal) return;
    setBusy(true);
    try {
      await cancelDeletionProposal(state.proposal.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("キャンセルに失敗しました", "Couldn’t cancel"));
    } finally {
      setBusy(false);
    }
  }

  async function onFinalize() {
    if (!state?.thresholdMet) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        tx(
          `「${projectName}」を本当に削除しますか？元に戻せません。`,
          `Delete “${projectName}” permanently? This can’t be undone.`,
        ),
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
      setDeleting(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-4 sm:px-5"
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600">
        {tx("プロジェクト削除の投票", "Project deletion vote")}
      </p>
      <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-zinc-950">
        {tx(
          `賛成 ${state.approveCount}人 · 反対 ${state.rejectCount}人`,
          `${state.approveCount} for · ${state.rejectCount} against`,
        )}
      </h3>
      <p className="mt-1 text-[12px] text-zinc-600">
        {tx(
          `メンバー ${state.memberCount}人中、賛成 ${threshold}人以上でオーナーが最終削除できます`,
          `${threshold}+ of ${state.memberCount} members must approve before the owner can delete`,
        )}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100">
        <div
          className={`h-full transition-all ${state.thresholdMet ? "bg-rose-500" : "bg-orange-400"}`}
          style={{ width: `${Math.min(100, (state.approveCount / Math.max(1, threshold)) * 100)}%` }}
        />
      </div>

      {error ? <p className="mt-2 text-[12px] text-rose-700">{error}</p> : null}

      {uid ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || deleting}
            onClick={() => void onVote(true)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition disabled:opacity-50 ${
              state.myVote === true
                ? "border-rose-300 bg-rose-100 text-rose-800"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {tx("賛成する", "Approve")}
          </button>
          <button
            type="button"
            disabled={busy || deleting}
            onClick={() => void onVote(false)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition disabled:opacity-50 ${
              state.myVote === false
                ? "border-zinc-300 bg-zinc-100 text-zinc-700"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {tx("反対する", "Oppose")}
          </button>
        </div>
      ) : null}

      {isOwner ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-rose-200/80 pt-3 sm:flex-row">
          <button
            type="button"
            disabled={busy || deleting || !state.thresholdMet}
            onClick={() => void onFinalize()}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting
              ? tx("削除中…", "Deleting…")
              : tx("最終削除する", "Finalize deletion")}
          </button>
          <button
            type="button"
            disabled={busy || deleting}
            onClick={() => void onCancel()}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {tx("提案を取り下げる", "Withdraw proposal")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
