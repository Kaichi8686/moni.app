"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type RoadmapPhaseInfo = {
  id: string;
  title: string;
  goal?: string;
  description?: string;
  stepNumber?: number;
};

type Props = {
  phase: RoadmapPhaseInfo | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onSave?: (patch: { goal: string; description: string }) => Promise<void>;
  /** 編集ページへのリンク（概要から開いたときなど） */
  editHref?: string;
};

export function RoadmapPhaseInfoSheet({
  phase,
  open,
  onClose,
  canEdit = false,
  onSave,
  editHref,
}: Props) {
  const { tx } = useI18n();
  const [goalDraft, setGoalDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!phase) return;
    setGoalDraft(phase.goal ?? "");
    setDescriptionDraft(phase.description ?? "");
  }, [phase]);

  useEffect(() => {
    if (open && phase) {
      setClosing(false);
      setVisible(true);
      return;
    }
    if (!open && visible) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 220);
      return () => window.clearTimeout(t);
    }
  }, [open, phase, visible]);

  if (!visible || !phase) return null;

  const editable = Boolean(canEdit && onSave);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSave() {
    if (!onSave || !editable) return;
    setBusy(true);
    try {
      await onSave({ goal: goalDraft.trim(), description: descriptionDraft.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center ${closing ? "roadmap-phase-sheet-root-out" : "roadmap-phase-sheet-root-in"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-phase-sheet-title"
    >
      <button
        type="button"
        className={`absolute inset-0 border-0 bg-black/40 ${closing ? "roadmap-phase-sheet-backdrop-out" : "roadmap-phase-sheet-backdrop-in"}`}
        aria-label={tx("閉じる", "Close")}
        onClick={requestClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.15)] sm:mx-4 sm:mb-4 sm:rounded-2xl ${
          closing ? "roadmap-phase-sheet-panel-out" : "roadmap-phase-sheet-panel-in"
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-200 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            {phase.stepNumber != null ? (
              <p className="text-[10px] font-bold tracking-[0.12em] text-zinc-400">STEP {phase.stepNumber}</p>
            ) : null}
            <h2 id="roadmap-phase-sheet-title" className="truncate text-sm font-bold text-zinc-900">
              {phase.title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            onClick={requestClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
            <label htmlFor="roadmap-phase-goal" className="block text-xs font-bold text-orange-900">
              {tx("このステップのゴール", "Goal for this step")}
            </label>
            <p className="mt-0.5 text-[11px] leading-snug text-orange-800/80">
              {tx("達成したら「できた」と言えることを書いてください", "Write what “done” looks like for this step")}
            </p>
            {editable ? (
              <textarea
                id="roadmap-phase-goal"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder={tx("例：ターゲットと直接10人話す", "e.g. Talk to 10 people in the target audience")}
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none ring-orange-400 focus:ring-2"
                disabled={busy}
              />
            ) : goalDraft.trim() || phase.goal?.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{phase.goal}</p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">{tx("まだ書かれていません", "Not set yet")}</p>
            )}
          </div>

          <div>
            <label htmlFor="roadmap-phase-overview" className="block text-xs font-semibold text-zinc-600">
              {tx("概要", "Overview")}
            </label>
            {editable ? (
              <textarea
                id="roadmap-phase-overview"
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                placeholder={tx("このステップでやることや背景を書いてください", "What you’ll do in this step, and why")}
                rows={4}
                className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none ring-orange-400 focus:ring-2"
                disabled={busy}
              />
            ) : descriptionDraft.trim() || phase.description?.trim() ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{phase.description}</p>
            ) : (
              <p className="mt-1.5 text-sm text-zinc-400">{tx("まだ書かれていません", "Not set yet")}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {editable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="min-h-[44px] w-full rounded-2xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? tx("保存中…", "Saving…") : tx("ゴールを保存", "Save goal")}
            </button>
          ) : null}
          {editHref && !editable ? (
            <Link
              href={editHref}
              className="flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              onClick={onClose}
            >
              {tx("ロードマップで編集", "Edit on roadmap")}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={requestClose}
            className="min-h-[40px] w-full rounded-2xl text-sm font-medium text-zinc-500 hover:bg-zinc-50"
          >
            {tx("閉じる", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
