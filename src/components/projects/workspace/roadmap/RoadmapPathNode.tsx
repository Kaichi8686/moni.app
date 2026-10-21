"use client";

import type { ReactNode } from "react";

export type RoadmapPathNodeTone = "active" | "done" | "upcoming" | "create";

type Props = {
  tone?: RoadmapPathNodeTone;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
};

const TONE_FACE: Record<RoadmapPathNodeTone, string> = {
  active: "bg-[#58CC02]",
  done: "bg-[#58CC02]",
  upcoming: "bg-[#E5E5E5]",
  create: "bg-[#58CC02]",
};

const TONE_BASE: Record<RoadmapPathNodeTone, string> = {
  active: "bg-[#46A302]",
  done: "bg-[#46A302]",
  upcoming: "bg-[#AFAFAF]",
  create: "bg-[#46A302]",
};

/**
 * Duolingo 風の立体円マス（ロードマップの1ステップ / 作成 CTA）。
 * アイコンやキャラは置かず、円そのものをマスとして使う。
 * Link で包むときは親に `group` を付け、このコンポーネントは見た目だけにする。
 */
export function RoadmapPathNode({
  tone = "active",
  label,
  selected = false,
  disabled = false,
  children,
  className = "",
  onClick,
  "aria-label": ariaLabel,
}: Props) {
  const face = TONE_FACE[tone];
  const base = TONE_BASE[tone];

  const body = (
    <>
      <span className="relative mx-auto block h-[72px] w-[72px] transition-transform duration-150 group-active:translate-y-[4px] sm:h-[80px] sm:w-[80px]">
        <span aria-hidden className={`absolute inset-x-0 bottom-0 top-[6px] rounded-full ${base}`} />
        <span
          className={`absolute inset-x-0 bottom-[6px] top-0 flex items-center justify-center rounded-full ${face} ${
            selected ? "ring-4 ring-[#58CC02]/35" : ""
          }`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[10%] rounded-full"
            style={{
              background: `radial-gradient(circle at 50% 28%, ${
                tone === "upcoming" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.42)"
              } 0%, transparent 62%)`,
            }}
          />
          {children ? (
            <span className="relative z-[1] flex items-center justify-center text-white">{children}</span>
          ) : null}
        </span>
      </span>
      {label ? (
        <span
          className={`mt-2 block max-w-[7.5rem] text-center text-[12px] font-bold leading-snug sm:max-w-[8.5rem] sm:text-[13px] ${
            tone === "upcoming" ? "text-zinc-400" : "text-zinc-800"
          }`}
        >
          {label}
        </span>
      ) : null}
    </>
  );

  const shellClass = `relative flex w-[7.5rem] flex-col items-center sm:w-[8.5rem] ${
    disabled ? "opacity-50" : ""
  } ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group cursor-pointer ${shellClass}`}
        aria-label={ariaLabel}
        aria-pressed={selected || undefined}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={shellClass} aria-label={ariaLabel}>
      {body}
    </div>
  );
}
