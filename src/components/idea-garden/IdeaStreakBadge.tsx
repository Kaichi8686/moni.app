"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  days: number;
  className?: string;
  onClick?: () => void;
};

/** Duolingo 風の連続日数バッジ（タップでカレンダー） */
export function IdeaStreakBadge({ days, className = "", onClick }: Props) {
  const { tx } = useI18n();
  const active = days > 0;

  const classes = `inline-flex items-center gap-2 rounded-full border-[3px] px-3 py-1.5 outline-none transition active:scale-[0.97] ${
    active
      ? "border-[#FF9600]/40 bg-[#FFF4E0]"
      : "border-zinc-200 bg-white"
  } ${onClick ? "cursor-pointer" : ""} ${className}`;

  const body = (
    <>
      <span
        aria-hidden
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[18px] ${
          active ? "bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]" : "bg-zinc-200 text-zinc-400"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c1.5 3.2-.2 5.2-1.4 6.6C9.2 10.2 8 11.6 8 14a4 4 0 0 0 8 0c0-2.8-1.6-4.6-2.8-6C11.8 6.5 12 4.2 12 2zm0 18a2.5 2.5 0 0 1-2.5-2.5c0-1.2.7-2 1.5-2.8.3.9.9 1.5 1.7 1.8.5.2 1 .7 1 1.5A2.5 2.5 0 0 1 12 20z" />
        </svg>
      </span>
      <div className="pr-1 text-left leading-tight">
        <p
          className={`text-[20px] font-extrabold tabular-nums tracking-tight ${
            active ? "text-[#D97706]" : "text-zinc-400"
          }`}
        >
          {days}
        </p>
        <p className={`text-[11px] font-bold ${active ? "text-[#B45309]" : "text-zinc-400"}`}>
          {tx("日連続", "day streak")}
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classes}
        aria-label={tx(`${days}日連続・カレンダーを開く`, `${days} day streak · open calendar`)}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={classes} aria-label={tx(`${days}日連続`, `${days} day streak`)}>
      {body}
    </div>
  );
}
