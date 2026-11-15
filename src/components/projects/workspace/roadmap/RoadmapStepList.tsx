"use client";

import type { ReactNode } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { PhaseStatus } from "@/lib/roadmap/types";

export type RoadmapStepListTask = {
  id: string;
  title: string;
  description?: string;
  /** 期限表示（例: 期限 2026-11-20） */
  dueLabel?: string;
  status: "todo" | "done" | "active";
  badge?: string;
};

export type RoadmapStepListItem = {
  id: string;
  title: string;
  goal?: string;
  description?: string;
  status: PhaseStatus;
  /** 本線の何番目か（1始まり） */
  stepNumber: number;
  tasks?: RoadmapStepListTask[];
};

type Props = {
  steps: RoadmapStepListItem[];
  /** 現在フォーカス中の本線インデックス（0始まり）。active 番号の色分けに使う */
  currentIndex?: number;
  expandedId: string | null;
  onToggle: (id: string) => void;
  /** 展開カード内の追加アクション（編集・達成など） */
  renderExpandedActions?: (step: RoadmapStepListItem) => ReactNode;
  empty?: ReactNode;
  className?: string;
};

function stepTone(
  step: RoadmapStepListItem,
  currentIndex: number,
): "done" | "current" | "upcoming" {
  if (step.status === "completed") return "done";
  if (step.status === "in_progress") return "current";
  if (step.stepNumber - 1 === currentIndex) return "current";
  return "upcoming";
}

/**
 * 縦リスト型ロードマップ。
 * 左に番号バッジ＋縦線、右にタイトルカード。タップで詳細アコーディオン。
 */
export function RoadmapStepList({
  steps,
  currentIndex = 0,
  expandedId,
  onToggle,
  renderExpandedActions,
  empty,
  className = "",
}: Props) {
  const { tx } = useI18n();

  if (steps.length === 0) {
    return empty ? <div className={className}>{empty}</div> : null;
  }

  return (
    <ol className={`relative m-0 list-none space-y-3 p-0 ${className}`}>
      {steps.map((step, index) => {
        const expanded = expandedId === step.id;
        const tone = stepTone(step, currentIndex);
        const isLast = index === steps.length - 1;
        const tasks = step.tasks ?? [];
        const numberClass =
          tone === "done" || tone === "current"
            ? "bg-[#2563EB] text-white"
            : "bg-zinc-100 text-zinc-500";

        return (
          <li key={step.id} className="relative flex gap-3">
            {/* 左：番号＋縦線 */}
            <div className="relative flex w-9 shrink-0 flex-col items-center">
              <span
                className={`relative z-[1] flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ${numberClass}`}
                aria-hidden
              >
                {step.stepNumber}
              </span>
              {!isLast ? (
                <span
                  className="absolute left-1/2 top-9 bottom-[-12px] w-px -translate-x-1/2 bg-zinc-200"
                  aria-hidden
                />
              ) : null}
            </div>

            {/* 右：カード */}
            <div className="min-w-0 flex-1 pb-1">
              <div
                className={`overflow-hidden rounded-2xl border bg-white transition-[box-shadow,border-color] ${
                  expanded
                    ? "border-zinc-200 shadow-sm"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(step.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                    {tx(`ステップ ${step.stepNumber} – ${step.title}`, `Step ${step.stepNumber} – ${step.title}`)}
                  </span>
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500"
                    aria-hidden
                  >
                    {expanded ? <Minus className="h-4 w-4" strokeWidth={2.25} /> : <Plus className="h-4 w-4" strokeWidth={2.25} />}
                  </span>
                </button>

                {expanded ? (
                  <div className="roadmap-step-accordion-in border-t border-zinc-100 px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        {tx("ゴール", "Goal")}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-zinc-800">
                        {(step.goal ?? "").trim() ||
                          tx("まだゴールは書かれていません。", "No goal set yet.")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        {tx("詳細", "Details")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-700">
                        {(step.description ?? "").trim() ||
                          tx("まだ詳細はありません。", "No details yet.")}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        {tx("今やるべき課題", "Tasks to do now")}
                      </p>
                      {tasks.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {tasks.map((task) => {
                            const isDone = task.status === "done";
                            const isActive = task.status === "active";
                            return (
                              <li
                                key={task.id}
                                className={`rounded-xl px-3 py-2.5 ${
                                  isActive ? "bg-sky-50" : "bg-transparent"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                      isDone
                                        ? "bg-emerald-500 text-white"
                                        : isActive
                                          ? "border-2 border-[#2563EB]"
                                          : "border-2 border-zinc-300"
                                    }`}
                                    aria-hidden
                                  >
                                    {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-[14px] font-semibold leading-snug ${
                                        isDone ? "text-zinc-500" : "text-zinc-900"
                                      }`}
                                    >
                                      {task.title}
                                    </p>
                                    {task.description ? (
                                      <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                                        {task.description}
                                      </p>
                                    ) : null}
                                    {task.dueLabel ? (
                                      <p className="mt-1 text-[12px] font-medium text-zinc-500">
                                        {task.dueLabel}
                                      </p>
                                    ) : null}
                                    {task.badge ? (
                                      <span className="mt-1.5 inline-flex items-center rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                                        {task.badge}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1 text-[13px] text-zinc-500">
                          {tx("今やるべき課題はまだありません。", "No tasks to do right now.")}
                        </p>
                      )}
                    </div>

                    {renderExpandedActions ? (
                      <div className="flex flex-wrap gap-2 pt-1">{renderExpandedActions(step)}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
