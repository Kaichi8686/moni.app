"use client";

import type { ReactNode } from "react";

export type RoadmapPathNodeTone = "active" | "done" | "upcoming" | "create";

type Props = {
  tone?: RoadmapPathNodeTone;
  /** 進行中マスの周囲キラキラ */
  sparkle?: boolean;
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
 * Duolingo 風の立体円マス。
 * 名前はマス下に出さず、タップ後の詳細 UI で見せる。
 * Link で包むときは親に `group` を付ける。
 */
export function RoadmapPathNode({
  tone = "active",
  sparkle = false,
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
    <span
      data-roadmap-node
      className={`relative mx-auto block h-[72px] w-[72px] transition-transform duration-150 group-active:translate-y-[4px] sm:h-[80px] sm:w-[80px] ${
        sparkle ? "roadmap-node-sparkle" : ""
      }`}
    >
      {sparkle ? (
        <>
          <span className="roadmap-sparkle roadmap-sparkle-1" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-2" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-3" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-4" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-5" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-6" aria-hidden />
        </>
      ) : null}
      <span aria-hidden className={`absolute inset-x-0 bottom-0 top-[6px] rounded-full ${base}`} />
      <span
        className={`absolute inset-x-0 bottom-[6px] top-0 flex items-center justify-center rounded-full ${face} ${
          selected
            ? tone === "upcoming"
              ? "ring-4 ring-zinc-300/80"
              : "ring-4 ring-[#58CC02]/35"
            : sparkle
              ? "ring-4 ring-[#FFD84D]/55"
              : ""
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
          <span className="relative z-[1] flex items-center justify-center">{children}</span>
        ) : null}
      </span>
    </span>
  );

  const shellClass = `relative z-[1] flex w-[7.5rem] flex-col items-center sm:w-[8.5rem] ${
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
