"use client";

const HAIR = [
  // bob
  "M18 10c0-7 6-10 14-10s14 3 14 10v6H18z",
  // side part
  "M16 12c2-9 10-12 18-10 6 2 10 6 10 12v4H16z",
  // short
  "M20 14c1-6 6-9 12-9s11 3 12 9v2H20z",
  // spiky-ish
  "M18 16l4-12 6 8 6-10 6 10 4-6v12H18z",
] as const;

const COLORS = ["#FB923C", "#38BDF8", "#A78BFA", "#34D399", "#F472B6", "#FBBF24"] as const;

type Props = {
  seed: string;
  selected?: boolean;
  size?: number;
};

export function TargetAvatar({ seed, selected, size = 56 }: Props) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const hair = HAIR[h % HAIR.length]!;
  const skin = "#FED7AA";
  const hairColor = COLORS[(h >> 3) % COLORS.length]!;
  const shirt = COLORS[(h >> 5) % COLORS.length]!;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`mx-auto block transition-transform duration-300 ${
        selected ? "-translate-y-0.5" : ""
      }`}
      aria-hidden
    >
      <circle cx="32" cy="32" r="30" fill={selected ? "#FFF7E8" : "#F4F4F5"} />
      <ellipse cx="32" cy="54" rx="16" ry="8" fill={shirt} />
      <circle cx="32" cy="28" r="14" fill={skin} />
      <path d={hair} fill={hairColor} transform="translate(0 4)" />
      <circle cx="27" cy="28" r="1.6" fill="#44403C" />
      <circle cx="37" cy="28" r="1.6" fill="#44403C" />
      <path d="M28 34c2 2 6 2 8 0" fill="none" stroke="#A8A29E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
