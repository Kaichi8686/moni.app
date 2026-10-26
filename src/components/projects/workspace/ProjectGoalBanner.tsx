"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  goal: string;
  className?: string;
};

/**
 * Duolingo のユニット見出し風バナー（moni オレンジ）。
 * 上段: 「プロジェクト名」のゴール / 下段: ユーザーが書いたゴール本文。
 */
export function ProjectGoalBanner({ projectName, goal, className = "" }: Props) {
  const { tx } = useI18n();
  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  if (!goalText) return null;

  const eyebrow = tx(`「${name}」のゴール`, `Goal of “${name}”`);

  return (
    <div
      className={`relative isolate ${className}`}
      role="region"
      aria-label={eyebrow}
    >
      {/* 立体感用の下縁（パスマスと同じオレンジ系） */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 top-[6px] rounded-[1.15rem] bg-[#C2410C] sm:rounded-[1.35rem]"
      />
      <div className="relative overflow-hidden rounded-[1.15rem] bg-[#F97316] px-4 py-3 text-white sm:rounded-[1.35rem] sm:px-5 sm:py-3.5">
        <p className="truncate text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
          {eyebrow}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight sm:text-base">
          {goalText}
        </p>
      </div>
    </div>
  );
}
