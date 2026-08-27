"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelDeletionProposal,
  castDeletionVote,
  fetchDeletionState,
  proposeDeletion,
  type DeletionState,
} from "@/lib/projects/deletionVote";

type Props = {
  open: boolean;
  projectId: string;
  projectName: string;
  uid: string | null;
  isOwner: boolean;
  deleting: boolean;
  onClose: () => void;
  onFinalizeDelete: () => Promise<void>;
};

export function ProjectDeleteVotePanel({
  open,
  projectId,
  projectName,
  uid,
  isOwner,
  deleting,
  onClose,
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
    if (!open) return;
    void reload();
    const t = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(t);
  }, [open, reload]);

  if (!open) return null;

  const threshold = state ? Math.ceil((state.memberCount * 2) / 3) : 0;

  async function onPropose() {
    if (!uid) return;
    setBusy(true);
    try {
      await proposeDeletion(projectId, uid);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提案に失敗しました");
    } finally {
      setBusy(false);
    }
  }

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-[#1A1A1A]">プロジェクト削除の手続き</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
          「{projectName}」の削除には、メンバーの<strong className="text-[#374151]">2/3以上の賛成</strong>
          が必要です。その後、オーナーが最終削除できます。
        </p>

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p> : null}

        {!state ? (
          <p className="mt-4 text-sm text-[#6B7280]">読み込み中…</p>
        ) : !state.proposal ? (
          <div className="mt-4 space-y-3">
            <p className="text-[12px] text-[#6B7280]">現在、削除提案はありません。</p>
            {isOwner ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onPropose()}
                className="w-full rounded-md bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                削除を提案する
              </button>
            ) : (
              <p className="text-[12px] text-[#9CA3AF]">削除提案はオーナーのみ開始できます。</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3">
              <p className="text-[13px] font-semibold text-[#1A1A1A]">
                賛成 {state.approveCount} / {state.memberCount}人
                <span className="ml-2 text-[11px] font-medium text-[#6B7280]">（必要: {threshold}人）</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className={`h-full transition-all ${state.thresholdMet ? "bg-rose-500" : "bg-[#5E6AD2]"}`}
                  style={{ width: `${Math.min(100, (state.approveCount / Math.max(1, threshold)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-[#6B7280]">
                {state.thresholdMet
                  ? "基準を満たしました。オーナーが最終削除できます。"
                  : "まだ基準に達していません。"}
              </p>
            </div>

            {uid ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onVote(true)}
                  className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-semibold ${
                    state.myVote === true
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F7F8F8]"
                  }`}
                >
                  賛成する
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onVote(false)}
                  className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-semibold ${
                    state.myVote === false
                      ? "border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]"
                      : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F7F8F8]"
                  }`}
                >
                  反対する
                </button>
              </div>
            ) : null}

            {isOwner ? (
              <div className="flex flex-col gap-2 border-t border-[#F1F3F5] pt-3">
                <button
                  type="button"
                  disabled={busy || deleting || !state.thresholdMet}
                  onClick={() => void onFinalizeDelete()}
                  className="w-full rounded-md bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "削除中…" : "最終削除する（オーナー）"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCancel()}
                  className="w-full rounded-md border border-[#E5E7EB] px-4 py-2 text-[12px] font-medium text-[#6B7280] hover:bg-[#F7F8F8]"
                >
                  提案を取り下げる
                </button>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          className="mt-4 w-full rounded-md px-3 py-2 text-[13px] font-medium text-[#6B7280] hover:bg-[#F7F8F8]"
          onClick={onClose}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
