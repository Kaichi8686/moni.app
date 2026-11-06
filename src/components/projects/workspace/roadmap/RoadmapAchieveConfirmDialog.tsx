"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  goal?: string;
  stepTitle?: string;
  unfinishedIssueCount?: number;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function RoadmapAchieveConfirmDialog({
  open,
  goal,
  stepTitle,
  unfinishedIssueCount = 0,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const { tx } = useI18n();
  if (!open) return null;

  const goalText = (goal ?? "").trim();
  const hasOpenIssues = unfinishedIssueCount > 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-achieve-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="roadmap-achieve-confirm-title" className="text-base font-bold text-gray-900">
          {tx("本当に達成してよいですか？", "Mark this step as achieved?")}
        </h2>
        {stepTitle ? (
          <p className="mt-1 text-xs font-medium text-zinc-500">{stepTitle}</p>
        ) : null}

        <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2.5">
          <p className="text-[11px] font-bold text-orange-900">{tx("このステップのゴール", "Goal for this step")}</p>
          {goalText ? (
            <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-zinc-900">{goalText}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">{tx("ゴールはまだ書かれていません", "No goal set yet")}</p>
          )}
        </div>

        {hasOpenIssues ? (
          <p
            className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold leading-relaxed text-amber-900"
            role="status"
          >
            {tx(
              `このステップの課題がまだ ${unfinishedIssueCount} 件終わっていません。それでも達成してよいですか？`,
              `${unfinishedIssueCount} issue${unfinishedIssueCount === 1 ? "" : "s"} on this step are still unfinished. Mark as achieved anyway?`,
            )}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            {tx(
              "達成するとこのマスが進みます。内容を確認してから進めてください。",
              "Confirming will advance this step. Double-check before continuing.",
            )}
          </p>
        )}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[12px] text-rose-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {tx("キャンセル", "Cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
              hasOpenIssues
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {busy ? tx("反映中…", "Updating…") : tx("達成する", "Achieve")}
          </button>
        </div>
      </div>
    </div>
  );
}
