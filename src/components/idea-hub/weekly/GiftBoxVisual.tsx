"use client";

import { GIFT_PATTERNS, type GiftPatternId } from "@/lib/idea-hub/weeklyBottles";

type Props = {
  pattern: GiftPatternId;
  size?: "sm" | "md" | "lg" | "xl";
  open?: boolean;
  shaking?: boolean;
  className?: string;
};

const SIZE = {
  sm: "h-[4.5rem] w-[4.5rem]",
  md: "h-28 w-28",
  lg: "h-40 w-40",
  xl: "h-52 w-52",
} as const;

/** Chunky cartoon gift — Duolingo illustration energy */
export function GiftBoxVisual({
  pattern,
  size = "md",
  open = false,
  shaking = false,
  className = "",
}: Props) {
  const meta = GIFT_PATTERNS.find((g) => g.id === pattern) ?? GIFT_PATTERNS[0];

  return (
    <div
      className={`relative ${SIZE[size]} ${shaking ? "animate-[duo-gift-shake_0.45s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden
    >
      {/* 3D base shadow */}
      <div
        className="absolute inset-x-[8%] bottom-0 top-[18%] rounded-[1.1rem]"
        style={{ background: meta.base }}
      />

      {/* Lid */}
      <div
        className="absolute left-1/2 z-30 w-[118%] origin-[50%_100%] transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        style={{
          top: open ? "-48%" : "-4%",
          transform: `translateX(-50%) ${open ? "rotate(-26deg) translate(-12%, -6%)" : "rotate(0)"}`,
        }}
      >
        <div
          className="relative h-[32%] min-h-[1.55rem] w-full rounded-[0.85rem] border-[3px] border-black/10"
          style={{
            background: `linear-gradient(180deg, ${meta.ribbon} 0%, ${meta.ribbon} 70%, ${shade(meta.ribbon, -18)} 100%)`,
            boxShadow: `0 4px 0 ${shade(meta.ribbon, -28)}`,
          }}
        >
          {/* bow knot */}
          <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-[60%] items-center">
            <span
              className="h-5 w-5 -rotate-[25deg] rounded-full border-2 border-black/10"
              style={{ background: meta.ribbon, boxShadow: `0 2px 0 ${shade(meta.ribbon, -25)}` }}
            />
            <span
              className="z-[1] -mx-1 h-4 w-4 rounded-full border-2 border-black/10"
              style={{ background: shade(meta.ribbon, -10) }}
            />
            <span
              className="h-5 w-5 rotate-[25deg] rounded-full border-2 border-black/10"
              style={{ background: meta.ribbon, boxShadow: `0 2px 0 ${shade(meta.ribbon, -25)}` }}
            />
          </div>
        </div>
      </div>

      {/* Box body */}
      <div
        className="absolute inset-x-[6%] bottom-[6%] top-[14%] overflow-hidden rounded-[1.05rem] border-[3px] border-black/10"
        style={{
          background: patternFill(pattern, meta.wrap, meta.accent),
          boxShadow: `inset 0 3px 0 rgba(255,255,255,0.28)`,
        }}
      >
        {/* vertical ribbon */}
        <div
          className="absolute inset-y-0 left-1/2 w-[22%] -translate-x-1/2 border-x-2 border-black/5"
          style={{ background: meta.ribbon }}
        />
        {/* horizontal ribbon */}
        <div
          className="absolute inset-x-0 top-[42%] h-[20%] border-y-2 border-black/5"
          style={{ background: meta.ribbon }}
        />
        {/* face highlight */}
        <div className="pointer-events-none absolute inset-x-[12%] top-[8%] h-[28%] rounded-full bg-white/25 blur-[1px]" />

        {open ? (
          <div className="absolute inset-x-[14%] top-[12%] bottom-[10%] flex items-center justify-center rounded-md bg-[#1a1a1a]/20">
            <div
              className="h-[70%] w-[36%] rounded-full border-2 border-[#C4842D]/55"
              style={{
                background: "repeating-linear-gradient(90deg, #FFF8E7 0 4px, #FFE2A8 4px 7px)",
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function patternFill(pattern: GiftPatternId, wrap: string, accent: string): string {
  switch (pattern) {
    case "stripe":
      return `repeating-linear-gradient(-32deg, ${wrap}, ${wrap} 12px, ${accent} 12px, ${accent} 22px)`;
    case "dots":
      return `radial-gradient(circle at 25% 30%, rgba(255,255,255,0.45) 0 5px, transparent 6px),
        radial-gradient(circle at 70% 55%, rgba(255,255,255,0.35) 0 4px, transparent 5px),
        radial-gradient(circle at 40% 78%, rgba(255,255,255,0.3) 0 3px, transparent 4px),
        ${wrap}`;
    case "plaid":
      return `repeating-linear-gradient(90deg, ${wrap} 0 14px, ${accent} 14px 18px),
        repeating-linear-gradient(0deg, transparent 0 14px, rgba(255,255,255,0.18) 14px 18px)`;
    case "ribbon":
      return `linear-gradient(145deg, ${wrap} 0%, ${accent} 100%)`;
    case "wave":
      return `repeating-radial-gradient(circle at 0 40%, transparent 0 10px, rgba(255,255,255,0.2) 10px 14px), ${wrap}`;
    case "spark":
      return `linear-gradient(160deg, ${wrap}, ${accent}),
        radial-gradient(circle at 22% 28%, rgba(255,255,255,0.55) 0 3px, transparent 4px),
        radial-gradient(circle at 72% 42%, rgba(255,255,255,0.45) 0 2px, transparent 3px)`;
    default:
      return wrap;
  }
}

/** crude hex shade helper */
function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
