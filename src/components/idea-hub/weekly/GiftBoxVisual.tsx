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
  sm: "h-[5.25rem] w-[5.25rem]",
  md: "h-36 w-36",
  lg: "h-48 w-48",
  xl: "h-60 w-60",
} as const;

/** Deep isometric gift + clean folded paper bow. */
export function GiftBoxVisual({
  pattern,
  size = "md",
  open = false,
  shaking = false,
  className = "",
}: Props) {
  const meta = GIFT_PATTERNS.find((g) => g.id === pattern) ?? GIFT_PATTERNS[0];
  const uid = `g3-${pattern}-${size}`;
  const wrap = meta.wrap;
  const wrapDark = shade(wrap, -40);
  const wrapMid = shade(wrap, -18);
  const wrapLight = shade(wrap, 30);
  const accent = meta.accent;
  const ribbon = meta.ribbon;
  const rDark = shade(ribbon, -40);
  const rMid = shade(ribbon, -10);
  const rLight = shade(ribbon, 32);

  return (
    <div
      className={`relative ${SIZE[size]} ${shaking ? "animate-[duo-gift-shake_0.45s_ease-in-out_infinite]" : ""} ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor={wrapLight} />
            <stop offset="40%" stopColor={wrap} />
            <stop offset="100%" stopColor={wrapMid} />
          </linearGradient>
          <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0%" stopColor={wrapMid} />
            <stop offset="100%" stopColor={wrapDark} />
          </linearGradient>
          <linearGradient id={`${uid}-t`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={wrapLight} />
            <stop offset="100%" stopColor={wrap} />
          </linearGradient>
          <linearGradient id={`${uid}-rv`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={rDark} />
            <stop offset="30%" stopColor={ribbon} />
            <stop offset="50%" stopColor={rLight} />
            <stop offset="100%" stopColor={rDark} />
          </linearGradient>
          <linearGradient id={`${uid}-rh`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rLight} />
            <stop offset="55%" stopColor={ribbon} />
            <stop offset="100%" stopColor={rDark} />
          </linearGradient>
          <pattern id={`${uid}-p`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <rect width="16" height="16" fill={wrap} />
            {(pattern === "stripe" || pattern === "plaid") && (
              <rect width="8" height="16" fill={accent} opacity="0.9" />
            )}
            {(pattern === "dots" || pattern === "spark" || pattern === "wave") && (
              <>
                <circle cx="4" cy="5" r="2.2" fill="#fff" opacity="0.4" />
                <circle cx="12" cy="11" r="1.6" fill="#fff" opacity="0.3" />
              </>
            )}
            {pattern === "ribbon" && <rect width="16" height="16" fill={accent} opacity="0.25" />}
          </pattern>
          <filter id={`${uid}-ds`} x="-25%" y="-15%" width="160%" height="150%">
            <feDropShadow dx="2" dy="8" stdDeviation="4" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>

        <ellipse cx="104" cy="186" rx="52" ry="8" fill="rgba(0,0,0,0.18)" />

        <g filter={`url(#${uid}-ds)`}>
          {/* RIGHT extrusion — deep */}
          <polygon
            points="130,78 168,98 168,158 130,178"
            fill={`url(#${uid}-s)`}
            stroke={wrapDark}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* side ribbon */}
          <polygon points="130,118 168,138 168,148 130,128" fill={rDark} />
          <polygon points="130,78 142,84 142,178 130,178" fill={`url(#${uid}-rv)`} opacity="0.7" />

          {/* FRONT face */}
          <polygon
            points="40,98 130,98 130,178 40,178"
            fill={`url(#${uid}-p)`}
            stroke={wrapDark}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <polygon points="40,98 130,98 130,178 40,178" fill={`url(#${uid}-f)`} opacity="0.4" />

          {/* front ribbons — flat strips */}
          <rect x="78" y="98" width="16" height="80" fill={`url(#${uid}-rv)`} />
          <rect x="40" y="128" width="90" height="14" fill={`url(#${uid}-rh)`} />

          {/* front edge highlight */}
          <polyline points="44,102 44,172" stroke="#fff" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
        </g>

        {/* LID group */}
        <g
          style={{
            transformOrigin: "85px 78px",
            transform: open ? "translate(-22px,-48px) rotate(-32deg)" : undefined,
            transition: "transform 0.55s cubic-bezier(0.34,1.4,0.64,1)",
          }}
        >
          {/* lid top diamond */}
          <polygon
            points="40,78 85,48 168,78 123,108"
            fill={`url(#${uid}-t)`}
            stroke={wrapDark}
            strokeWidth="1.5"
            strokeLinejoin="round"
            filter={`url(#${uid}-ds)`}
          />
          {/* lid thickness */}
          <polygon points="40,78 123,108 123,116 40,86" fill={wrapMid} />
          <polygon points="123,108 168,78 168,86 123,116" fill={wrapDark} />

          {/* lid ribbons */}
          <polygon points="78,64 92,56 100,60 86,70" fill={`url(#${uid}-rh)`} />
          <polygon points="55,92 130,62 136,66 62,98" fill={`url(#${uid}-rh)`} />

          {!open ? (
            <g transform="translate(85 52)">
              {/* Simple knot where ribbons cross — no looping bow */}
              <rect
                x="-9"
                y="-9"
                width="18"
                height="18"
                rx="3"
                fill={rMid}
                stroke={rDark}
                strokeWidth="1.6"
              />
              <rect x="-5.5" y="-5.5" width="11" height="11" rx="2" fill={rLight} />
              <circle cx="0" cy="0" r="2.2" fill={rDark} opacity="0.35" />
            </g>
          ) : null}
        </g>

        {open ? (
          <g>
            <polygon points="58,112 112,112 112,158 58,158" fill="rgba(0,0,0,0.32)" />
            <rect x="76" y="118" width="18" height="34" rx="9" fill="#FFF3D1" stroke="#C4842D" strokeWidth="2" />
          </g>
        ) : null}
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
