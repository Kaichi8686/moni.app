"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelDeletionProposal,
  castDeletionVote,
  fetchDeletionState,
  type DeletionState,
} from "@/lib/projects/deletionVote";

type Props = {
  projectId: string;
  projectName: string;
  uid: string | null;
  isOwner: boolean;
  deleting: boolean;
  onFinalizeDelete: () => Promise<void>;
};

export function ProjectDeletionProposalBanner({
  projectId,
  projectName,
  uid,
  isOwner,
  deleting,
  onFinalizeDelete,
}: Props) {
  const [state, setState] = useState<DeletionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const next = await fetchDeletionState(projectId, uid);
      setState(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    }
  }, [projectId, uid]);

  useEffect(() => {
    void reload();
    const t = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(t);
  }, [reload]);

  if (!state?.proposal) return null;

  const threshold = Math.ceil((state.memberCount * 2) / 3);

  async function onVote(approve: boolean) {
    if (!uid || !state?.proposal) return;
    setBusy(true);
    try {
      await castDeletionVote(projectId, state.proposal.id, uid, approve);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票に失敗しました");
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
      setError(e instanceof Error ? e.message : "キャンセルに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3"
      role="region"
      aria-label="プロジェクト削除の提案"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-rose-900">
            「{projectName}」の削除が提案されています
          </p>
          <p className="mt-0.5 text-[12px] text-rose-800/80">
            削除するかどうか、メンバーの賛否を選んでください。賛成 {state.approveCount} / {state.memberCount}
            人（必要: {threshold}人）
            {state.thresholdMet ? " — 基準到達。オーナーが最終削除できます。" : ""}
          </p>
          <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-rose-100">
            <div
              className={`h-full transition-all ${state.thresholdMet ? "bg-rose-500" : "bg-[#5E6AD2]"}`}
              style={{ width: `${Math.min(100, (state.approveCount / Math.max(1, threshold)) * 100)}%` }}
            />
          </div>
          {error ? <p className="mt-2 text-[12px] text-rose-700">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {uid ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onVote(true)}
                className={`rounded-md border px-3 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                  state.myVote === true
                    ? "border-rose-400 bg-rose-600 text-white"
                    : "border-rose-200 bg-white text-rose-800 hover:bg-rose-100"
                }`}
              >
                削除に賛成
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onVote(false)}
                className={`rounded-md border px-3 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                  state.myVote === false
                    ? "border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-white/80"
                }`}
              >
                反対
              </button>
            </>
          ) : null}

          {isOwner ? (
            <>
              <button
                type="button"
                disabled={busy || deleting || !state.thresholdMet}
                onClick={() => void onFinalizeDelete()}
                className="rounded-md bg-rose-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "削除中…" : "最終削除する"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCancel()}
                className="rounded-md border border-rose-200 bg-white px-3 py-2 text-[12px] font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                提案を取り下げる
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
