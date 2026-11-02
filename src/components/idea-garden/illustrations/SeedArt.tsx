"use client";

type Props = {
  className?: string;
  glowing?: boolean;
};

/** キラキラ種 */
export function SeedArt({ className = "", glowing = true }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      {glowing ? (
        <>
          <circle cx="60" cy="60" r="42" fill="#FDE68A" opacity="0.35">
            <animate attributeName="r" values="38;46;38" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.45;0.25" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="60" r="28" fill="#FEF3C7" opacity="0.55" />
          {/* sparkles */}
          {[
            [18, 28],
            [98, 34],
            [22, 88],
            [96, 82],
            [60, 12],
            [60, 108],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path
                d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
                fill="#FBBF24"
              >
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.3"
                  dur={`${1.1 + i * 0.15}s`}
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ))}
        </>
      ) : null}
      {/* seed body */}
      <ellipse cx="60" cy="62" rx="18" ry="24" fill="#A16207" stroke="#78350F" strokeWidth="3" />
      <ellipse cx="54" cy="54" rx="6" ry="10" fill="#D97706" opacity="0.55" />
      <path
        d="M60 40 C66 48 66 76 60 84"
        fill="none"
        stroke="#78350F"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
