"use client";

type Props = {
  className?: string;
  showSeed?: boolean;
  gold?: boolean;
};

/** 空のプラント（種を埋めた状態） */
export function EmptyPotArt({ className = "", showSeed, gold }: Props) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <ellipse cx="100" cy="178" rx="54" ry="10" fill={gold ? "#A16207" : "#92400E"} opacity="0.25" />
      <path
        d="M58 120 L70 170 C72 178 128 178 130 170 L142 120 Z"
        fill={gold ? "#F59E0B" : "#E11D48"}
        stroke={gold ? "#B45309" : "#9F1239"}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="108"
        width="100"
        height="22"
        rx="8"
        fill={gold ? "#FBBF24" : "#FB7185"}
        stroke={gold ? "#B45309" : "#9F1239"}
        strokeWidth="4"
      />
      <ellipse cx="100" cy="118" rx="40" ry="10" fill={gold ? "#A16207" : "#57534E"} />
      {showSeed ? (
        <ellipse cx="100" cy="112" rx="12" ry="8" fill="#A16207" stroke="#78350F" strokeWidth="2" />
      ) : null}
    </svg>
  );
}
