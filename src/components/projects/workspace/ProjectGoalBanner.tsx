"use client";

import { ClipboardList } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  goal: string;
  /** 右のガイドアイコン押下（編集など） */
  onGuideClick?: () => void;
  className?: string;
};

/**
 * Duolingo のユニット見出し風バナー。
 * 上段: 「プロジェクト名」のゴール / 下段: ユーザーが書いたゴール本文。
 */
export function ProjectGoalBanner({ projectName, goal, onGuideClick, className = "" }: Props) {
  const { tx } = useI18n();
  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  if (!goalText) return null;

  const eyebrow = tx(`「${name}」のゴール`, `Goal of “${name}”`);
  const guideLabel = onGuideClick
    ? tx("きっかけとゴールを編集", "Edit motivation and goal")
    : tx("ゴール", "Goal");

  const icon = (
    <span className="flex h-full min-h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center sm:w-14" aria-hidden>
      <ClipboardList className="h-6 w-6 text-white sm:h-7 sm:w-7" strokeWidth={2.25} />
    </span>
  );

  return (
    <div
      className={`relative isolate ${className}`}
      role="region"
      aria-label={eyebrow}
    >
      {/* 立体感用の下縁 */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 top-[6px] rounded-[1.15rem] bg-[#9B1F6B] sm:rounded-[1.35rem]"
      />
      <div className="relative flex overflow-hidden rounded-[1.15rem] bg-[#CE2E8C] text-white sm:rounded-[1.35rem]">
        <div className="min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="truncate text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
            {eyebrow}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight sm:text-base">
            {goalText}
          </p>
        </div>
        <div className="flex shrink-0 border-l border-white/25 bg-[#B8247A]">
          {onGuideClick ? (
            <button
              type="button"
              onClick={onGuideClick}
              className="flex h-full items-center justify-center transition hover:bg-white/10 active:bg-white/15"
              aria-label={guideLabel}
            >
              {icon}
            </button>
          ) : (
            icon
          )}
        </div>
      </div>
    </div>
  );
}
