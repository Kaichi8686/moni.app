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
 * Isometric gift matching the reference: thick outlines, flat two-tone faces,
 * polka dots, yellow ribbon, fluffy rounded bow.
 */
export function GiftBoxVisual({
  pattern,
  size = "md",
  open = false,
  shaking = false,
  className = "",
}: Props) {
  const meta = GIFT_PATTERNS.find((g) => g.id === pattern) ?? GIFT_PATTERNS[0];
  const uid = `iso-${pattern}-${size}`;

  // Face colors (left = lit, right = shade) — like the red reference
  const left = meta.wrap;
  const right = shade(meta.wrap, -38);
  const top = shade(meta.wrap, 18);
  const dotL = shade(meta.accent, 40);
  const dotR = shade(meta.accent, -10);
  const ribbon = meta.ribbon; // yellow-ish
  const ribbonShade = shade(meta.ribbon, -28);
  const outline = "#2B2118";

  return (
    <div
      className={`relative ${SIZE[size]} ${shaking ? "animate-[duo-gift-shake_0.45s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 240 240" className="h-full w-full overflow-visible">
        <defs>
          <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="3" floodColor="#000" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* Floor shadow */}
        <ellipse cx="120" cy="220" rx="58" ry="10" fill="rgba(0,0,0,0.14)" />

        <g filter={`url(#${uid}-soft)`} stroke={outline} strokeWidth="3.2" strokeLinejoin="round">
          {/* ===== BODY ===== */}
          {/* Left face */}
          <polygon points="40,110 120,150 120,210 40,170" fill={left} />
          {/* Right face */}
          <polygon points="120,150 200,110 200,170 120,210" fill={right} />

          {/* Polka dots — left */}
          <g fill={dotL} stroke="none">
            <circle cx="68" cy="128" r="9" />
            <circle cx="92" cy="148" r="9" />
            <circle cx="64" cy="160" r="9" />
            <circle cx="90" cy="178" r="9" />
            <circle cx="70" cy="192" r="8" />
          </g>
          {/* Polka dots — right (darker) */}
          <g fill={dotR} stroke="none">
            <circle cx="150" cy="128" r="9" />
            <circle cx="174" cy="148" r="9" />
            <circle cx="148" cy="160" r="9" />
            <circle cx="172" cy="178" r="9" />
            <circle cx="152" cy="192" r="8" />
          </g>

          {/* Vertical ribbons on faces */}
          <polygon points="105,142 135,142 135,210 105,210" fill={ribbon} stroke={outline} strokeWidth="2.6" />
          {/* Right-face ribbon continuation */}
          <polygon points="120,150 140,140 140,200 120,210" fill={ribbonShade} stroke={outline} strokeWidth="2.2" />

          {/* ===== LID ===== */}
          <g
            style={{
              transformOrigin: "120px 100px",
              transform: open ? "translate(-20px,-40px) rotate(-26deg)" : undefined,
              transition: "transform 0.55s cubic-bezier(0.34,1.4,0.64,1)",
            }}
          >
            {/* Lid top */}
            <polygon points="40,100 120,60 200,100 120,140" fill={top} />
            {/* Lid side lip (front edge) */}
            <polygon points="40,100 120,140 120,150 40,110" fill={left} />
            <polygon points="120,140 200,100 200,110 120,150" fill={right} />

            {/* Top ribbon cross */}
            <polygon points="105,90 135,90 150,98 120,112 90,98" fill={ribbon} stroke={outline} strokeWidth="2.4" />
            <polygon points="112,72 128,72 148,112 92,112" fill={ribbon} stroke={outline} strokeWidth="2.4" />
            {/* Top ribbon highlight */}
            <line x1="100" y1="96" x2="118" y2="88" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />

            {/* Fluffy rounded bow — reference style */}
            {!open ? (
              <g transform="translate(120 58)" stroke={outline} strokeWidth="2.6" strokeLinejoin="round">
                {/* back loops */}
                <ellipse cx="-22" cy="-10" rx="20" ry="14" fill={ribbonShade} transform="rotate(-18 -22 -10)" />
                <ellipse cx="22" cy="-10" rx="20" ry="14" fill={ribbonShade} transform="rotate(18 22 -10)" />
                {/* front loops */}
                <ellipse cx="-18" cy="2" rx="22" ry="15" fill={ribbon} transform="rotate(-12 -18 2)" />
                <ellipse cx="18" cy="2" rx="22" ry="15" fill={ribbon} transform="rotate(12 18 2)" />
                {/* loop inner shade */}
                <ellipse cx="-18" cy="2" rx="10" ry="6" fill={ribbonShade} opacity="0.45" transform="rotate(-12 -18 2)" stroke="none" />
                <ellipse cx="18" cy="2" rx="10" ry="6" fill={ribbonShade} opacity="0.45" transform="rotate(12 18 2)" stroke="none" />
                {/* center knot */}
                <ellipse cx="0" cy="0" rx="11" ry="10" fill={ribbon} />
                <ellipse cx="-2" cy="-2" rx="4" ry="3" fill="#fff" opacity="0.4" stroke="none" />
                {/* short tails under bow */}
                <path d="M-6 8 Q-16 28 -8 30 Q0 20 4 10 Z" fill={ribbon} />
                <path d="M6 8 Q16 28 8 30 Q0 20 -2 10 Z" fill={ribbonShade} />
              </g>
            ) : null}
          </g>

          {/* Open cavity */}
          {open ? (
            <g stroke="none">
              <polygon points="70,130 170,130 150,175 90,175" fill="rgba(30,20,15,0.35)" />
              <rect x="108" y="138" width="24" height="36" rx="12" fill="#FFF3D1" stroke={outline} strokeWidth="2.4" />
            </g>
          ) : null}
        </g>

        {/* Ribbon edge highlight on left vertical */}
        <line x1="110" y1="148" x2="110" y2="200" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
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
