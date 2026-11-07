"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectName: string;
  /** 空のときは「ゴールを書く」プレースホルダ（写真ボタン風 CTA） */
  goal?: string;
  emptyHint?: string;
  className?: string;
  onClick?: () => void;
};

/**
 * プロジェクトゴールバナー / 初回の写真ボタン風 CTA。
 * idea-garden の DuoButton と同じ：上面フラット + 下帯シャドウ奥行き / 押すと沈む。
 * 文字は中央寄せ。
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
    <span className="flex w-full flex-col items-center justify-center text-center">
      <span className="block max-w-full truncate text-[12px] font-semibold leading-snug text-white/90 sm:text-[13px]">
        {eyebrow}
      </span>
      {isEmpty ? (
        <span className="mt-1 block text-[15px] font-extrabold leading-snug tracking-tight sm:text-base">
          {placeholder}
        </span>
      ) : (
        <span className="mt-0.5 line-clamp-2 block max-w-full text-[15px] font-extrabold leading-snug tracking-tight sm:text-base">
          {goalText}
        </span>
      )}
    </span>
  );

  const surface = [
    "w-full rounded-[1.15rem] bg-[#FF9600] px-4 text-center text-white sm:rounded-[1.35rem] sm:px-5",
    isEmpty
      ? "flex min-h-[7.5rem] items-center justify-center py-5 sm:min-h-[8.5rem] sm:py-6"
      : "py-3 sm:py-3.5",
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
