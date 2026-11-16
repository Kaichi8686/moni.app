"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  /** 課題タブへ飛ぶ用の issue id（あるときだけ押せる） */
  issueId?: string;
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
  /** 開いているステップ id（複数可） */
  expandedIds: readonly string[];
  onToggle: (id: string) => void;
  /** 展開カード内の追加アクション（編集・達成など） */
  renderExpandedActions?: (step: RoadmapStepListItem) => ReactNode;
  /** 今やるべき課題タップ時（課題タブへ） */
  onSelectTask?: (task: RoadmapStepListTask) => void;
  /** false のとき「今やるべき課題」ブロックを出さない（編集画面用） */
  showTasks?: boolean;
  /** false のとき現在ステップの番号も他と同じ大きさ（編集画面用） */
  emphasizeCurrent?: boolean;
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
  expandedIds,
  onToggle,
  renderExpandedActions,
  onSelectTask,
  showTasks = true,
  emphasizeCurrent = true,
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
        const expanded = expandedIds.includes(step.id);
        const tone = stepTone(step, currentIndex);
        const isLast = index === steps.length - 1;
        const tasks = step.tasks ?? [];
        const isCurrent = tone === "current";
        const largeCurrent = emphasizeCurrent && isCurrent;
        const numberClass =
          tone === "done" || tone === "current"
            ? "bg-[#FF9600] text-white"
            : "bg-zinc-100 text-zinc-500";
        const numberSize = largeCurrent
          ? "h-11 w-11 text-base"
          : "h-7 w-7 text-xs";

        return (
          <li key={step.id} className="relative flex gap-3">
            {/* 左：番号＋縦線 */}
            <div className="relative flex w-11 shrink-0 flex-col items-center pt-0.5">
              <span
                className={`relative z-[1] flex items-center justify-center ${numberSize}`}
                aria-hidden
              >
                {isCurrent ? (
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[175%] w-[175%] -translate-x-1/2 -translate-y-1/2"
                    aria-hidden
                  >
                    <span className="roadmap-current-badge-haze absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,150,0,0.72)_0%,rgba(255,255,255,0.92)_38%,rgba(255,150,0,0.28)_58%,transparent_78%)] blur-[3.5px]" />
                    <span className="roadmap-current-badge-haze roadmap-current-badge-haze--delay absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,150,0,0.62)_0%,rgba(255,255,255,0.85)_40%,rgba(255,150,0,0.22)_60%,transparent_78%)] blur-[3.5px]" />
                  </span>
                ) : null}
                <span
                  className={`relative z-[1] flex h-full w-full items-center justify-center rounded-full font-bold tabular-nums shadow-sm ${numberClass}`}
                >
                  {step.stepNumber}
                </span>
              </span>
              {!isLast ? (
                <span
                  className={`absolute left-1/2 bottom-[-12px] w-px -translate-x-1/2 bg-zinc-200 ${
                    largeCurrent ? "top-11" : "top-7"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>

            {/* 右：カード */}
            <div className="min-w-0 flex-1 pb-1">
              <div
                className={`overflow-hidden rounded-2xl border bg-white transition-[box-shadow,border-color] ${
                  expanded
                    ? "border-zinc-200 shadow-[0_0_6px_rgba(0,0,0,0.08)]"
                    : "border-zinc-200 shadow-sm hover:border-zinc-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(step.id)}
                  aria-expanded={expanded}
                  aria-label={tx(
                    `ステップ ${step.stepNumber}: ${step.title}`,
                    `Step ${step.stepNumber}: ${step.title}`,
                  )}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-zinc-900">
                    {step.title}
                  </span>
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500"
                    aria-hidden
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        expanded ? "rotate-180" : "rotate-0"
                      }`}
                      strokeWidth={2.25}
                    />
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

                    {showTasks ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          {tx("今やるべき課題", "Tasks to do now")}
                        </p>
                        {tasks.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {tasks.map((task) => {
                              const clickable = Boolean(task.issueId && onSelectTask);
                              const body = (
                                <>
                                  <div className="min-w-0 flex-1 text-left">
                                    <p className="text-[14px] font-semibold leading-snug text-zinc-900">
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
                                  {clickable ? (
                                    <ChevronRight
                                      className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400"
                                      aria-hidden
                                    />
                                  ) : null}
                                </>
                              );
                              return (
                                <li key={task.id}>
                                  {clickable ? (
                                    <button
                                      type="button"
                                      onClick={() => onSelectTask?.(task)}
                                      className="flex w-full items-start gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3.5 py-3 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-100/80 active:scale-[0.99]"
                                    >
                                      {body}
                                    </button>
                                  ) : (
                                    <div className="flex w-full items-start gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3.5 py-3">
                                      {body}
                                    </div>
                                  )}
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
                    ) : null}

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
