"use client";

import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  /** 空のときは「ゴールを書く」プレースホルダ */
  goal?: string;
  emptyHint?: string;
  className?: string;
  onClick?: () => void;
};

/**
 * プロジェクトゴールの通常ボタン風バナー。
 * （旧: DuoButton 風の下帯シャドウ／押下沈み込みは使わない）
 */
export function ProjectGoalBanner({
  projectName,
  goal = "",
  emptyHint,
  className = "",
  onClick,
}: Props) {
  const { tx } = useI18n();
  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  const isEmpty = !goalText;
  const eyebrow = tx(`「${name}」のゴール`, `Goal of “${name}”`);
  const placeholder =
    emptyHint?.trim() ||
    tx("タップしてゴールを書く", "Tap to write your goal");
  const openLabel = isEmpty
    ? tx("ゴールを書く", "Write goal")
    : tx("ゴールときっかけを開く", "Open goal and motivation");

  // 空バナーは CTA（onClick）専用。閲覧用の空表示は出さない。
  if (isEmpty && !onClick) return null;

  const face = (
    <span className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
      <span className="block max-w-full truncate text-[12px] font-medium leading-snug text-orange-700/80">
        {eyebrow}
      </span>
      {isEmpty ? (
        <span className="mt-1 block text-[15px] font-semibold leading-snug text-orange-950 sm:text-base">
          {placeholder}
        </span>
      ) : (
        <span className="mt-0.5 line-clamp-2 block max-w-full text-[15px] font-semibold leading-snug text-orange-950 sm:text-base">
          {goalText}
        </span>
      )}
    </span>
  );

  const surface = [
    "relative w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 shadow-sm sm:px-5",
    "transition-colors duration-150",
  ].join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={openLabel}
        className={[
          surface,
          "flex items-center gap-2 pr-10 hover:border-orange-300 hover:bg-orange-100/80 active:bg-orange-100 sm:pr-11",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {face}
        <ChevronRight className="absolute right-3 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-orange-400 sm:right-4" aria-hidden />
      </button>
    );
  }

  return (
    <div className={[surface, className].filter(Boolean).join(" ")} role="region" aria-label={eyebrow}>
      {face}
    </div>
  );
}
