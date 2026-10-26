"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  goal: string;
  className?: string;
  onClick?: () => void;
};

/**
 * Duolingo のユニット見出し風バナー（moni オレンジ）。
 * 上段: 「プロジェクト名」のゴール / 下段: ユーザーが書いたゴール本文。
 * 押すと詳細（きっかけなど）へ。
 */
export function ProjectGoalBanner({ projectName, goal, className = "", onClick }: Props) {
  const { tx } = useI18n();
  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  if (!goalText) return null;

  const eyebrow = tx(`「${name}」のゴール`, `Goal of “${name}”`);
  const openLabel = tx("ゴールときっかけを見る", "View goal and motivation");

  const face = (
    <>
      {/* 立体感用の下縁（パスマスと同じオレンジ系） */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 top-[6px] rounded-[1.15rem] bg-[#C2410C] sm:rounded-[1.35rem]"
      />
      <span className="relative block overflow-hidden rounded-[1.15rem] bg-[#F97316] px-4 py-3 text-left text-white sm:rounded-[1.35rem] sm:px-5 sm:py-3.5">
        <span className="block truncate text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
          {eyebrow}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[15px] font-bold leading-snug tracking-tight sm:text-base">
          {goalText}
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative isolate w-full transition active:translate-y-[3px] active:[&>span:first-child]:opacity-0 ${className}`}
        aria-label={openLabel}
      >
        {face}
      </button>
    );
  }

  return (
    <div className={`relative isolate ${className}`} role="region" aria-label={eyebrow}>
      {face}
    </div>
  );
}
