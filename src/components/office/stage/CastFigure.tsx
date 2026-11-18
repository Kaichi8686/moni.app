"use client";

import type { CastLook, CastMember } from "@/lib/office/cast";
import type { CastEmotion } from "@/lib/office/scenes";

const SKINS = ["#FED7AA", "#FDBA74", "#F5D0A9", "#E7C6A5"];
const HAIRS = ["#292524", "#78350F", "#F59E0B", "#9F1239"];
const SHIRTS = ["#FB923C", "#38BDF8", "#A78BFA", "#34D399", "#F472B6", "#FBBF24"];

const HAIR_PATHS = [
  "M20 22c0-10 8-14 18-14s18 4 18 14v8H20z",
  "M18 24c2-12 12-16 22-14 8 2 14 8 14 16v6H18z",
  "M22 26c1-8 8-12 16-12s15 4 16 12v4H22z",
  "M20 28l5-14 7 10 7-12 7 10 5-8v16H20z",
];

type Props = {
  member: CastMember;
  emotion?: CastEmotion | null;
  enter?: boolean;
  className?: string;
};

function faceFor(emotion: CastEmotion | null | undefined) {
  switch (emotion) {
    case "angry":
      return { brow: true, mouth: "M28 48c4-3 12-3 16 0", eyes: "angry" as const };
    case "happy":
      return { brow: false, mouth: "M28 46c4 5 12 5 16 0", eyes: "happy" as const };
    case "worried":
      return { brow: true, mouth: "M30 48c4 2 8 2 12 0", eyes: "normal" as const };
    case "smug":
      return { brow: false, mouth: "M30 47c6 2 12 0 14-2", eyes: "smug" as const };
    case "panic":
      return { brow: true, mouth: "M32 46a4 3 0 1 0 0.1 0", eyes: "panic" as const };
    default:
      return { brow: false, mouth: "M30 48c3 2 9 2 12 0", eyes: "normal" as const };
  }
}

export function CastFigure({ member, emotion, enter, className }: Props) {
  const look: CastLook = member.look;
  const skin = SKINS[look.skin % SKINS.length]!;
  const hair = HAIRS[look.hair % HAIRS.length]!;
  const shirt = SHIRTS[look.color % SHIRTS.length]!;
  const hairPath = HAIR_PATHS[look.hair % HAIR_PATHS.length]!;
  const face = faceFor(emotion);

  return (
    <svg
      viewBox="0 0 72 96"
      className={`h-full w-auto max-h-full ${enter ? "office-cast-enter" : ""} ${className ?? ""}`}
      role="img"
      aria-label={member.name}
    >
      <ellipse cx="36" cy="90" rx="18" ry="5" fill="#00000014" />
      <rect x="22" y="58" width="28" height="30" rx="8" fill={shirt} />
      {look.accessory === 1 ? (
        <rect x="24" y="56" width="24" height="6" rx="2" fill="#FDE68A" />
      ) : null}
      {look.accessory === 2 ? (
        <circle cx="54" cy="42" r="5" fill="#93C5FD" opacity="0.85" />
      ) : null}
      <circle cx="36" cy="38" r="18" fill={skin} />
      <path d={hairPath} fill={hair} />
      {face.eyes === "happy" ? (
        <>
          <path d="M28 36c2-2 5-2 7 0" stroke="#44403C" strokeWidth="2" fill="none" />
          <path d="M37 36c2-2 5-2 7 0" stroke="#44403C" strokeWidth="2" fill="none" />
        </>
      ) : (
        <>
          <circle cx="30" cy="36" r={face.eyes === "panic" ? 3 : 2.2} fill="#44403C" />
          <circle cx="42" cy="36" r={face.eyes === "panic" ? 3 : 2.2} fill="#44403C" />
        </>
      )}
      {face.brow ? (
        <>
          <path d="M26 30h8" stroke="#44403C" strokeWidth="2" />
          <path d="M38 30h8" stroke="#44403C" strokeWidth="2" />
        </>
      ) : null}
      <path d={face.mouth} stroke="#A8A29E" strokeWidth="2" fill="none" strokeLinecap="round" />
      {look.accessory === 3 ? (
        <rect x="20" y="40" width="10" height="6" rx="1" fill="#1E293B" opacity="0.7" />
      ) : null}
    </svg>
  );
}
