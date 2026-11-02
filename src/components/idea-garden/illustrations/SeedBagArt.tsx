"use client";

import type { FlowerKind } from "@/lib/idea-garden/types";
import { bagByKind } from "@/lib/idea-garden/seedBags";
import { MiniFlowerArt } from "@/components/idea-garden/illustrations/FlowerArt";

type Props = {
  kind: FlowerKind;
  className?: string;
  selected?: boolean;
};

/** 種袋 — 前面にその花のミニ絵 */
export function SeedBagArt({ kind, className = "", selected }: Props) {
  const bag = bagByKind(kind);
  return (
    <svg
      viewBox="0 0 160 200"
      className={className}
      aria-hidden
      style={{ filter: selected ? "drop-shadow(0 10px 18px rgba(0,0,0,0.18))" : undefined }}
    >
      {/* bag body */}
      <path
        d="M28 48 C28 28 52 18 80 18 C108 18 132 28 132 48 L142 168 C142 184 120 192 80 192 C40 192 18 184 18 168 Z"
        fill={bag.bagColor}
        stroke={bag.bagShadow}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {/* folded top */}
      <path
        d="M34 52 C40 36 60 28 80 28 C100 28 120 36 126 52"
        fill="none"
        stroke={bag.bagShadow}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse cx="80" cy="48" rx="48" ry="14" fill={bag.bagShadow} opacity="0.35" />
      {/* label panel */}
      <rect x="40" y="72" width="80" height="88" rx="14" fill="#FFFDF7" stroke={bag.bagShadow} strokeWidth="4" />
      <g transform="translate(48, 86)">
        <MiniFlowerArt kind={kind} size={64} />
      </g>
      {/* stitch */}
      <path
        d="M48 168 H112"
        stroke={bag.bagShadow}
        strokeWidth="3"
        strokeDasharray="6 6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
