"use client";

type Props = {
  size?: "xs" | "sm" | "md" | "lg";
  /** Cap + short neck only — body is inside the crate hole. */
  seated?: boolean;
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

const SEATED_SIZE = {
  xs: "h-8 w-7",
  sm: "h-11 w-9",
  md: "h-20 w-14",
  lg: "h-28 w-18",
} as const;

/** Milk bottle — full, or seated (only what sticks out of the hole). */
export function BottleVisual({
  size = "md",
  seated = false,
  corkOpen = false,
  showPaper = true,
  paperRising = false,
  className = "",
}: Props) {
  const uid = `milk-${size}-${seated ? "s" : "f"}-${corkOpen ? "o" : "c"}`;

  if (seated) {
    // Cap + very short neck stub — body is inside the crate
    return (
      <div className={`relative ${SEATED_SIZE[size]} ${className}`} aria-hidden>
        <svg viewBox="0 0 60 48" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6AA8B8" />
              <stop offset="40%" stopColor="#EAF7FB" />
              <stop offset="100%" stopColor="#4A8A9C" />
            </linearGradient>
            <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F8EED8" />
              <stop offset="100%" stopColor="#C4A060" />
            </linearGradient>
          </defs>
          {/* Short neck stub disappearing into the hole */}
          <rect x="22" y="28" width="16" height="18" rx="2.5" fill={`url(#${uid}-g)`} stroke="#3A7080" strokeWidth="2" />
          <rect x="24" y="30" width="4" height="10" rx="1.5" fill="#fff" opacity="0.5" />
          {/* Cap */}
          <g
            style={{
              transformOrigin: "30px 20px",
              transform: corkOpen ? "translate(-14px,-12px) rotate(-26deg)" : undefined,
              transition: "transform 0.45s ease",
            }}
          >
            <rect x="16" y="6" width="28" height="14" rx="3" fill={`url(#${uid}-cap)`} stroke="#8B6914" strokeWidth="1.6" />
            <rect x="14" y="18" width="32" height="8" rx="2" fill="#E5A500" stroke="#8B6914" strokeWidth="1.3" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${SIZE[size]} ${className}`} aria-hidden>
      <svg viewBox="0 0 100 160" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(90,150,170,0.55)" />
            <stop offset="28%" stopColor="rgba(210,235,245,0.8)" />
            <stop offset="100%" stopColor="rgba(60,120,145,0.55)" />
          </linearGradient>
          <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7F2E8" />
            <stop offset="100%" stopColor="#C4A878" />
          </linearGradient>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFC800" />
            <stop offset="100%" stopColor="#C4842D" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="154" rx="28" ry="5" fill="rgba(20,40,50,0.18)" />
        <path
          d="M36 42 C36 36,38 32,42 30 L58 30 C62 32,64 36,64 42 L68 52 C72 58,74 64,74 72 L74 138 C74 146,68 150,50 150 C32 150,26 146,26 138 L26 72 C26 64,28 58,32 52 Z"
          fill={`url(#${uid}-glass)`}
          stroke="rgba(50,110,135,0.7)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M34 58 C36 70,36 100,35 130 L40 130 C42 100,42 70,40 58 Z" fill="rgba(255,255,255,0.55)" />
        <rect x="40" y="26" width="20" height="16" rx="3" fill="rgba(190,225,235,0.65)" stroke="rgba(70,130,150,0.5)" strokeWidth="1.5" />
        {showPaper ? (
          <g
            style={{
              transform: paperRising ? "translateY(-14px) scale(1.08)" : undefined,
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
          </g>
        ) : null}
        <g
          style={{
            transformOrigin: "50px 22px",
            transform: corkOpen ? "translate(-28px,-22px) rotate(-28deg)" : undefined,
            transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <rect x="36" y="12" width="28" height="12" rx="3" fill={`url(#${uid}-cap)`} stroke="#B89A6A" strokeWidth="1.2" />
          <rect x="34" y="22" width="32" height="7" rx="2" fill={`url(#${uid}-band)`} stroke="#8B5A2B" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
