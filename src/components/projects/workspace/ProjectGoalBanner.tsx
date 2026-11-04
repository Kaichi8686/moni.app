"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  goal: string;
  className?: string;
  onClick?: () => void;
};

/**
 * プロジェクトゴールバナー。
 * idea-garden の DuoButton と同じ：上面フラット + 下帯シャドウ奥行き / 押すと沈む。
 */
export function ProjectGoalBanner({ projectName, goal, className = "", onClick }: Props) {
  const { tx } = useI18n();
  const name = projectName.trim() || tx("プロジェクト", "Project");
  const goalText = goal.trim();
  if (!goalText) return null;

  const eyebrow = tx(`「${name}」のゴール`, `Goal of “${name}”`);
  const openLabel = tx("ゴールときっかけを開く", "Open goal and motivation");

  const face = (
    <>
      <span className="block truncate text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
        {eyebrow}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[15px] font-extrabold leading-snug tracking-tight sm:text-base">
        {goalText}
      </span>
    </>
  );

  const surface = [
    "w-full rounded-[1.15rem] bg-[#FF9600] px-4 py-3 text-left text-white sm:rounded-[1.35rem] sm:px-5 sm:py-3.5",
    "shadow-[0_5px_0_#D97706]",
    "transition-[transform,box-shadow] duration-75 ease-out",
  ].join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={openLabel}
        className={[
          surface,
          "select-none active:translate-y-[5px] active:shadow-none",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {face}
      </button>
    );
  }

  return (
    <div className={[surface, className].filter(Boolean).join(" ")} role="region" aria-label={eyebrow}>
      {face}
    </div>
  );
}
