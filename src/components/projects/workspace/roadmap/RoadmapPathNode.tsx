"use client";

import type { ReactNode } from "react";

export type RoadmapPathNodeTone = "active" | "done" | "upcoming" | "create";

type Props = {
  tone?: RoadmapPathNodeTone;
  /** 進行中マスの周囲キラキラ */
  sparkle?: boolean;
  /** いま取り組んでいるマスを囲むオレンジの外枠（編集・作成画面用） */
  currentHalo?: boolean;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
};

/** moni オレンジの立体マス（上面色） */
const TONE_FACE: Record<RoadmapPathNodeTone, string> = {
  active: "bg-[#FF9600]",
  done: "bg-[#FF9600]",
  upcoming: "bg-[#E5E5E5]",
  create: "bg-[#FF9600]",
};

/** DuoButton と同じくぼかしなしの下帯（押すと消える） */
const TONE_LIP: Record<RoadmapPathNodeTone, string> = {
  active: "shadow-[0_6px_0_#D97706]",
  done: "shadow-[0_6px_0_#D97706]",
  upcoming: "shadow-[0_6px_0_#AFAFAF]",
  create: "shadow-[0_6px_0_#D97706]",
};

/**
 * Duolingo / アイデアタブ DuoButton と同じ押し心地の立体円マス。
 * 上面はフラット一色、奥行きは下帯 box-shadow、押すと沈んで影が消える。
 */
export function RoadmapPathNode({
  tone = "active",
  sparkle = false,
  currentHalo = false,
  selected = false,
  disabled = false,
  children,
  className = "",
  onClick,
  "aria-label": ariaLabel,
}: Props) {
  const face = TONE_FACE[tone];
  const lip = TONE_LIP[tone];

  const body = (
    <span
      data-roadmap-node
      className={`relative mx-auto block h-[72px] w-[72px] sm:h-[80px] sm:w-[80px] ${
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
          <span className="roadmap-sparkle roadmap-sparkle-burst roadmap-sparkle-7" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-burst roadmap-sparkle-8" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-burst roadmap-sparkle-9" aria-hidden />
          <span className="roadmap-sparkle roadmap-sparkle-burst roadmap-sparkle-10" aria-hidden />
        </>
      ) : null}
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-full transition-[transform,box-shadow] duration-75 ease-out group-active:translate-y-[6px] group-active:shadow-none ${face} ${lip} ${
          // 進行中外枠があるときは選択リングと重ねない
          !currentHalo && selected
            ? tone === "upcoming"
              ? "ring-4 ring-zinc-300/80"
              : "ring-4 ring-orange-300/60"
            : !currentHalo && sparkle
              ? "ring-[5px] ring-[#FFD84D]/70"
              : ""
        }`}
      >
        {/* マス本体の子にして同心円＋押下時も一緒に動く。すき間は狭く1本だけ */}
        {currentHalo ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-[5px] rounded-full border-[3px] border-[#FF9600]"
          />
        ) : null}
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
        className={`group cursor-pointer select-none ${shellClass}`}
        aria-label={ariaLabel}
        aria-pressed={selected || undefined}
      >
        {body}
      </button>
    );
  }

  // ドラッグ用など：親が group を付けて押下演出を使う
  return (
    <div className={`group ${shellClass}`} aria-label={ariaLabel}>
      {body}
    </div>
  );
}
