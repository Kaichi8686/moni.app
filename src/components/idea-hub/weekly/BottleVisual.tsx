"use client";

type Props = {
  size?: "xs" | "sm" | "md" | "lg";
  corkOpen?: boolean;
  showPaper?: boolean;
  paperRising?: boolean;
  className?: string;
};

const SIZE = {
  xs: "h-12 w-8",
  sm: "h-[4.75rem] w-11",
  md: "h-44 w-[6.5rem]",
  lg: "h-60 w-36",
} as const;

/** Japanese milk bottle (牛乳瓶) — squared body, wide mouth, thick glass. */
export function BottleVisual({
  size = "md",
  corkOpen = false,
  showPaper = true,
  paperRising = false,
  className = "",
}: Props) {
  const uid = `mb-${size}-${corkOpen ? "o" : "c"}-${paperRising ? "p" : "r"}`;

  return (
    <div className={`relative ${SIZE[size]} ${className}`} aria-hidden>
      <svg viewBox="0 0 100 160" className="h-full w-full overflow-visible" role="img">
        <defs>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(90,150,170,0.55)" />
            <stop offset="28%" stopColor="rgba(210,235,245,0.75)" />
            <stop offset="55%" stopColor="rgba(160,210,225,0.45)" />
            <stop offset="100%" stopColor="rgba(60,120,145,0.55)" />
          </linearGradient>
          <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7F2E8" />
            <stop offset="60%" stopColor="#E0D0A8" />
            <stop offset="100%" stopColor="#C4A878" />
          </linearGradient>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFC800" />
            <stop offset="100%" stopColor="#C4842D" />
          </linearGradient>
          <filter id={`${uid}-sh`} x="-30%" y="-10%" width="160%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="2.5" floodColor="#1a3a4a" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Ground */}
        <ellipse cx="50" cy="154" rx="28" ry="5" fill="rgba(20,40,50,0.18)" />

        <g filter={`url(#${uid}-sh)`}>
          {/* Body — squared milk bottle silhouette */}
          <path
            d="
              M36 42
              C36 36, 38 32, 42 30
              L58 30
              C62 32, 64 36, 64 42
              L68 52
              C72 58, 74 64, 74 72
              L74 138
              C74 146, 68 150, 50 150
              C32 150, 26 146, 26 138
              L26 72
              C26 64, 28 58, 32 52
              Z
            "
            fill={`url(#${uid}-glass)`}
            stroke="rgba(50,110,135,0.65)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Right depth facet */}
          <path
            d="M64 42 L74 72 L74 138 C74 144, 70 148, 58 149 L58 72 C58 62, 60 52, 64 42 Z"
            fill="rgba(40,100,120,0.18)"
          />

          {/* Left specular */}
          <path
            d="M34 58 C36 70, 36 100, 35 130 L40 130 C42 100, 42 70, 40 58 Z"
            fill="rgba(255,255,255,0.55)"
          />

          {/* Embossed ring */}
          <rect
            x="34"
            y="88"
            width="32"
            height="8"
            rx="4"
            fill="rgba(255,255,255,0.12)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
          />

          {/* Neck glass */}
          <rect
            x="40"
            y="26"
            width="20"
            height="16"
            rx="3"
            fill="rgba(190,225,235,0.65)"
            stroke="rgba(70,130,150,0.5)"
            strokeWidth="1.5"
          />

          {/* Paper roll inside */}
          {showPaper ? (
            <g
              style={{
                transform: paperRising ? "translateY(-14px) scale(1.08)" : "translateY(0)",
                transformOrigin: "50px 110px",
                transition: "transform 0.5s ease",
              }}
            >
              <rect
                x={paperRising ? 38 : 42}
                y={paperRising ? 78 : 96}
                width={paperRising ? 24 : 16}
                height={paperRising ? 36 : 34}
                rx="3"
                fill={paperRising ? "#FFF8E7" : "#FFE2A8"}
                stroke="#C4842D"
                strokeWidth="1.5"
                transform={paperRising ? undefined : "rotate(-8 50 113)"}
              />
              {!paperRising ? (
                <rect
                  x="43"
                  y="97"
                  width="4"
                  height="32"
                  fill="#F5D9A0"
                  transform="rotate(-8 50 113)"
                  opacity="0.7"
                />
              ) : null}
            </g>
          ) : null}

          {/* Bottom glass thickness */}
          <ellipse cx="50" cy="142" rx="18" ry="4" fill="rgba(40,100,120,0.2)" />
        </g>

        {/* Cap / foil lid */}
        <g
          style={{
            transformOrigin: "50px 22px",
            transform: corkOpen ? "translate(-28px, -22px) rotate(-28deg)" : "none",
            transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <rect x="36" y="12" width="28" height="12" rx="3" fill={`url(#${uid}-cap)`} stroke="#B89A6A" strokeWidth="1.2" />
          <rect x="34" y="22" width="32" height="7" rx="2" fill={`url(#${uid}-band)`} stroke="#8B5A2B" strokeWidth="1" />
          <rect x="40" y="14" width="10" height="3" rx="1" fill="rgba(255,255,255,0.45)" />
        </g>
      </svg>
    </div>
  );
}
