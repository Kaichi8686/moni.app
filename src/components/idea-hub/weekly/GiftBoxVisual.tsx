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
  sm: "h-[5.5rem] w-[5.5rem]",
  md: "h-36 w-36",
  lg: "h-48 w-48",
  xl: "h-60 w-60",
} as const;

/**
 * Proper isometric gift cube (real box proportions) + fabric-like ribbon bow.
 */
export function GiftBoxVisual({
  pattern,
  size = "md",
  open = false,
  shaking = false,
  className = "",
}: Props) {
  const meta = GIFT_PATTERNS.find((g) => g.id === pattern) ?? GIFT_PATTERNS[0];
  const left = meta.wrap;
  const right = shade(meta.wrap, -36);
  const top = shade(meta.wrap, 20);
  const dotL = shade(meta.accent, 35);
  const dotR = shade(meta.accent, -8);
  const ribbon = meta.ribbon;
  const rDark = shade(meta.ribbon, -28);
  const rLight = shade(meta.ribbon, 26);
  const outline = "#2B2118";

  const leftC = [52, 112] as const;
  const rightC = [188, 112] as const;
  const bottomC = [120, 146] as const;
  const leftBot = [52, 186] as const;
  const rightBot = [188, 186] as const;
  const bottomBot = [120, 220] as const;

  const poly = (...pts: readonly (readonly number[])[]) => pts.map((p) => p.join(",")).join(" ");

  return (
    <div
      className={`relative ${SIZE[size]} ${shaking ? "animate-[duo-gift-shake_0.45s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 240 240" className="h-full w-full overflow-visible">
        <ellipse cx="120" cy="226" rx="62" ry="9" fill="rgba(0,0,0,0.16)" />

        <g stroke={outline} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          {/* LEFT face */}
          <polygon
            points={poly(leftC, bottomC, bottomBot, leftBot)}
            fill={left}
          />
          {/* RIGHT face */}
          <polygon
            points={poly(bottomC, rightC, rightBot, bottomBot)}
            fill={right}
          />

          {/* Polka dots left */}
          <g fill={dotL} stroke="none">
            <circle cx="78" cy="130" r="8" />
            <circle cx="96" cy="148" r="8" />
            <circle cx="74" cy="160" r="7" />
            <circle cx="98" cy="176" r="7" />
            <circle cx="80" cy="190" r="6" />
          </g>
          {/* Polka dots right */}
          <g fill={dotR} stroke="none">
            <circle cx="148" cy="130" r="8" />
            <circle cx="166" cy="148" r="8" />
            <circle cx="144" cy="160" r="7" />
            <circle cx="168" cy="176" r="7" />
            <circle cx="150" cy="190" r="6" />
          </g>

          {/* Vertical ribbon left+right faces */}
          <polygon
            points={poly([108, 128], [132, 128], [132, 220], [108, 220])}
            fill={ribbon}
            stroke={outline}
            strokeWidth="2.5"
          />
          {/* ribbon on right face continuation */}
          <polygon
            points={poly([120, 146], [138, 137], [138, 210], [120, 220])}
            fill={rDark}
            stroke={outline}
            strokeWidth="2"
          />

          {/* LID group */}
          <g
            style={{
              transformOrigin: "120px 112px",
              transform: open ? "translate(-18px,-42px) rotate(-28deg)" : undefined,
              transition: "transform 0.55s cubic-bezier(0.34,1.4,0.64,1)",
            }}
          >
            {/* Lid top (slightly larger) */}
            <polygon
              points={poly(
                [44, 108],
                [120, 66],
                [196, 108],
                [120, 150],
              )}
              fill={top}
            />
            {/* Lid thickness left */}
            <polygon points={poly([44, 108], [120, 150], [120, 158], [44, 116])} fill={left} />
            {/* Lid thickness right */}
            <polygon points={poly([120, 150], [196, 108], [196, 116], [120, 158])} fill={right} />

            {/* Ribbon on lid */}
            <polygon
              points={poly([108, 96], [132, 96], [144, 108], [120, 126], [96, 108])}
              fill={ribbon}
              stroke={outline}
              strokeWidth="2.4"
            />
            <polygon
              points={poly([112, 78], [128, 78], [148, 124], [92, 124])}
              fill={ribbon}
              stroke={outline}
              strokeWidth="2.4"
            />
            <line x1="100" y1="100" x2="116" y2="90" stroke="#fff" strokeWidth="2.2" opacity="0.5" />

            {/* Fluffy bow — reference style */}
            {!open ? (
              <g transform="translate(120 62)" stroke={outline} strokeWidth="2.6" strokeLinejoin="round">
                <ellipse cx="-22" cy="-8" rx="18" ry="13" fill={rDark} transform="rotate(-18 -22 -8)" />
                <ellipse cx="22" cy="-8" rx="18" ry="13" fill={rDark} transform="rotate(18 22 -8)" />
                <ellipse cx="-20" cy="4" rx="22" ry="14" fill={ribbon} transform="rotate(-12 -20 4)" />
                <ellipse cx="20" cy="4" rx="22" ry="14" fill={rLight} transform="rotate(12 20 4)" />
                <ellipse cx="-20" cy="4" rx="9" ry="5" fill={rDark} opacity="0.35" transform="rotate(-12 -20 4)" stroke="none" />
                <ellipse cx="20" cy="4" rx="9" ry="5" fill={rDark} opacity="0.35" transform="rotate(12 20 4)" stroke="none" />
                <ellipse cx="0" cy="2" rx="11" ry="10" fill={ribbon} />
                <ellipse cx="-2" cy="-1" rx="4" ry="3" fill="#fff" opacity="0.4" stroke="none" />
                {/* Short tails stay on the lid — don't hang down the front face */}
                <path d="M-5 9 Q-12 22 -4 24 Q0 16 2 10 Z" fill={ribbon} />
                <path d="M5 9 Q12 22 4 24 Q0 16 -1 10 Z" fill={rLight} />
              </g>
            ) : null}
          </g>

          {open ? (
            <g stroke="none">
              <polygon points={poly([80, 140], [160, 140], [148, 190], [92, 190])} fill="rgba(20,12,8,0.35)" />
              <rect x="108" y="148" width="24" height="36" rx="12" fill="#FFF3D1" stroke={outline} strokeWidth="2.4" />
            </g>
          ) : null}
        </g>
      </svg>
    </div>
  );
}

function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
