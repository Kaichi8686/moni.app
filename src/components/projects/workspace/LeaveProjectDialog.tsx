"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import {
  leaveProject,
  leaveProjectErrorMessage,
  transferOwnershipAndLeave,
  type LeaveProjectErrorCode,
} from "@/lib/projects/leaveProject";
import { clearLastProjectIfMatches } from "@/lib/workspace/lastProject";
import type { Member } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  projectId: string;
  isOwner: boolean;
  members: Member[];
  currentUserId: string | null;
  onClose: () => void;
};

export function LeaveProjectDialog({
  open,
  projectId,
  isOwner,
  members,
  currentUserId,
  onClose,
}: Props) {
  const { tx } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(isOwner ? "pick" : "confirm");
    setTransferTargetId("");
    setErr("");
    setBusy(false);
  }, [open, isOwner]);

  const otherMembers = useMemo(
    () => members.filter((m) => m.id !== currentUserId),
    [members, currentUserId],
  );
  const isSoleOwner = Boolean(isOwner && otherMembers.length === 0);
  const selected = otherMembers.find((m) => m.id === transferTargetId) ?? null;

  function resetAndClose() {
    setStep("pick");
    setTransferTargetId("");
    setErr("");
    setBusy(false);
    onClose();
  }

  function leaveErrText(code: LeaveProjectErrorCode, fallback: string): string {
    const ja = leaveProjectErrorMessage(code, fallback);
    const enMap: Partial<Record<LeaveProjectErrorCode, string>> = {
      not_authenticated: "Login required.",
      project_not_found: "Project not found.",
      owner_must_transfer_first: "Owners must transfer ownership before leaving.",
      not_a_member: "You’re not a member of this project.",
      only_current_owner: "Only the current owner can transfer ownership.",
      new_owner_must_be_member: "The new owner must already be a project member.",
      already_owner: "You’re already the owner.",
      supabase_unavailable: "Supabase is not configured.",
      unknown: fallback || "Failed to leave the project.",
    };
    return tx(ja, enMap[code] ?? (fallback || "Failed to leave the project."));
  }

  async function confirmLeave() {
    if (!currentUserId) return;
    setBusy(true);
    setErr("");
    try {
      let result;
      if (isOwner) {
        if (!transferTargetId) {
          setErr(tx("次のオーナーを選んでください。", "Choose the next owner."));
          return;
        }
        result = await transferOwnershipAndLeave(projectId, transferTargetId);
      } else {
        result = await leaveProject(projectId);
      }
      if (!result.ok) {
        setErr(leaveErrText(result.code, result.error));
        return;
      }
      clearLastProjectIfMatches(projectId);
      router.push(HOME_PROJECTS_HREF);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-project-title"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <h2 id="leave-project-title" className="text-[15px] font-bold text-zinc-950">
            {tx("プロジェクトを脱退", "Leave project")}
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            onClick={resetAndClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          {err ? (
            <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
              {err}
            </p>
          ) : null}

          {isSoleOwner ? (
            <p className="text-[13px] leading-relaxed text-zinc-600">
              {tx(
                "あなたが唯一のメンバーです。脱退するには、メニューからプロジェクトを削除してください。",
                "You’re the only member. Delete the project from the menu to leave.",
              )}
            </p>
          ) : isOwner && step === "pick" ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-zinc-600">
                {tx(
                  "オーナーが脱退するには、次のオーナーを指名してください。",
                  "As owner, pick the next owner before leaving.",
                )}
              </p>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {otherMembers.map((m) => {
                  const active = transferTargetId === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setTransferTargetId(m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                          active ? "bg-orange-50 ring-1 ring-[#FF9600]/50" : "hover:bg-zinc-50"
                        }`}
                      >
                        <Avatar name={m.name} url={m.avatarUrl} />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-zinc-900">
                          {m.name}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            active ? "border-[#FF9600] bg-[#FF9600] text-white" : "border-zinc-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {active ? "✓" : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <LogOut className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-semibold text-zinc-900">
                {tx("本当に脱退しますか？", "Leave this project?")}
              </p>
              <p className="text-[13px] leading-relaxed text-zinc-600">
                {isOwner && selected
                  ? tx(
                      `オーナー権限は ${selected.name} さんに引き継がれます。脱退後はアクセスできなくなります。`,
                      `Ownership will go to ${selected.name}. You’ll lose access after leaving.`,
                    )
                  : tx(
                      "脱退するとメンバーではなくなり、チャットなどにもアクセスできなくなります。",
                      "You’ll no longer be a member and will lose access to chat and other areas.",
                    )}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={resetAndClose}
            className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-[13px] font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {tx("キャンセル", "Cancel")}
          </button>
          {isSoleOwner ? null : isOwner && step === "pick" ? (
            <button
              type="button"
              disabled={!transferTargetId || busy}
              onClick={() => setStep("confirm")}
              className="flex-1 rounded-xl bg-[#FF9600] py-2.5 text-[13px] font-bold text-white shadow-[0_3px_0_#E08600] transition active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {tx("次へ", "Next")}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || (isOwner && !transferTargetId)}
              onClick={() => void confirmLeave()}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[13px] font-bold text-white shadow-[0_3px_0_#BE123C] transition active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {busy ? tx("脱退中…", "Leaving…") : tx("脱退する", "Leave")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
