"use client";

import { PenLine, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  goal: string;
  problemMotivation: string;
  canEdit?: boolean;
  onEdit?: () => void;
};

/** ゴールバナー押下後の詳細画面。ゴールときっかけをまとめて見せる。 */
export function ProjectGoalDetailSheet({
  open,
  onClose,
  projectName,
  goal,
  problemMotivation,
  canEdit = false,
  onEdit,
}: Props) {
  const { tx } = useI18n();

  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  const motivationText = problemMotivation.trim();
  const title = tx(`「${name}」のゴール`, `Goal of “${name}”`);

  if (!open || !goalText) return null;

  return (
    <div
      className="roadmap-phase-sheet-root-in fixed inset-0 z-[80] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-goal-sheet-title"
    >
      <button
        type="button"
        className="roadmap-phase-sheet-backdrop-in absolute inset-0 border-0 bg-black/40"
        aria-label={tx("閉じる", "Close")}
        onClick={onClose}
      />
      <div className="roadmap-phase-sheet-panel-in relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.15)] sm:mx-4 sm:mb-4 sm:rounded-2xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-200 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 id="project-goal-sheet-title" className="min-w-0 truncate text-sm font-bold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            onClick={onClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
            <p className="text-[11px] font-bold tracking-wide text-orange-800">
              {tx("このプロジェクトのゴール", "Project goal")}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed text-zinc-900">
              {goalText}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-zinc-500">
              {tx(
                "どのようなことを解決したくてこのプロジェクトを思いついたか",
                "What problem made you think of this project?",
              )}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
              {motivationText || "—"}
            </p>
          </div>
        </div>

        {canEdit && onEdit ? (
          <div className="flex shrink-0 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              {tx("きっかけとゴールを編集", "Edit motivation and goal")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
