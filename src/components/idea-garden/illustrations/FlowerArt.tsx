"use client";

import type { FlowerKind } from "@/lib/idea-garden/types";

type FlowerProps = {
  kind: FlowerKind;
  size?: number;
  gold?: boolean;
  className?: string;
  /** 成長段階 0=種跡 1=芽 2=茎+葉 3=つぼみ 4=満開 */
  stage?: 0 | 1 | 2 | 3 | 4;
};

const PALETTE: Record<
  FlowerKind,
  { petal: string; petalDark: string; center: string; leaf: string }
> = {
  rose: { petal: "#FB7185", petalDark: "#E11D48", center: "#FEF3C7", leaf: "#22C55E" },
  sunflower: { petal: "#FBBF24", petalDark: "#D97706", center: "#78350F", leaf: "#16A34A" },
  tulip: { petal: "#F43F5E", petalDark: "#BE123C", center: "#FDE68A", leaf: "#22C55E" },
  lavender: { petal: "#A78BFA", petalDark: "#7C3AED", center: "#F5F3FF", leaf: "#4ADE80" },
  daisy: { petal: "#F8FAFC", petalDark: "#CBD5E1", center: "#FACC15", leaf: "#22C55E" },
  lily: { petal: "#FCE7F3", petalDark: "#F9A8D4", center: "#FDE047", leaf: "#16A34A" },
};

function goldify(c: string, gold?: boolean): string {
  if (!gold) return c;
  // map toward gold tones while keeping some shape contrast
  if (c === "#78350F") return "#92400E";
  if (c === "#F8FAFC" || c === "#F5F3FF" || c === "#FEF3C7" || c === "#FCE7F3") return "#FEF3C7";
  return "#FBBF24";
}

/** ミニ花（種袋ラベル用） */
export function MiniFlowerArt({
  kind,
  size = 64,
  gold,
}: {
  kind: FlowerKind;
  size?: number;
  gold?: boolean;
}) {
  const p = PALETTE[kind];
  const petal = goldify(p.petal, gold);
  const petalDark = goldify(p.petalDark, gold);
  const center = goldify(p.center, gold);
  const leaf = gold ? "#CA8A04" : p.leaf;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <line x1="32" y1="36" x2="32" y2="58" stroke={leaf} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="22" cy="48" rx="10" ry="5" fill={leaf} transform="rotate(-25 22 48)" />
      <ellipse cx="42" cy="50" rx="10" ry="5" fill={leaf} transform="rotate(25 42 50)" />
      {kind === "sunflower" ? (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse
              key={deg}
              cx="32"
              cy="22"
              rx="7"
              ry="14"
              fill={petal}
              stroke={petalDark}
              strokeWidth="1.5"
              transform={`rotate(${deg} 32 28)`}
            />
          ))}
          <circle cx="32" cy="28" r="10" fill={center} stroke={petalDark} strokeWidth="2" />
        </>
      ) : kind === "tulip" ? (
        <>
          <path d="M20 36 C20 18 32 12 32 12 C32 12 44 18 44 36 Z" fill={petal} stroke={petalDark} strokeWidth="2" />
          <path d="M26 36 C26 24 32 18 32 18" fill="none" stroke={petalDark} strokeWidth="2" opacity="0.45" />
        </>
      ) : kind === "lavender" ? (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <circle cx={32 - 6} cy={30 - i * 5} r="5" fill={petal} stroke={petalDark} strokeWidth="1.2" />
              <circle cx={32 + 6} cy={30 - i * 5} r="5" fill={petal} stroke={petalDark} strokeWidth="1.2" />
            </g>
          ))}
          <circle cx="32" cy="8" r="5" fill={petal} stroke={petalDark} strokeWidth="1.2" />
        </>
      ) : (
        <>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="32"
              cy="20"
              rx="8"
              ry="12"
              fill={petal}
              stroke={petalDark}
              strokeWidth="1.6"
              transform={`rotate(${deg} 32 28)`}
            />
          ))}
          <circle cx="32" cy="28" r="7" fill={center} stroke={petalDark} strokeWidth="1.8" />
        </>
      )}
      {gold ? (
        <>
          <circle cx="14" cy="14" r="2.2" fill="#FEF08A" />
          <circle cx="50" cy="18" r="1.8" fill="#FEF08A" />
          <circle cx="18" cy="40" r="1.6" fill="#FDE68A" />
        </>
      ) : null}
    </svg>
  );
}

/** 鉢付きの成長アニメ用フラワー */
export function GrowingPlantArt({ kind, stage = 4, gold, className = "" }: FlowerProps) {
  const p = PALETTE[kind];
  const petal = goldify(p.petal, gold);
  const petalDark = goldify(p.petalDark, gold);
  const center = goldify(p.center, gold);
  const leaf = gold ? "#CA8A04" : p.leaf;
  const stemH = stage <= 0 ? 0 : stage === 1 ? 28 : stage === 2 ? 70 : stage === 3 ? 95 : 110;

  return (
    <svg viewBox="0 0 200 260" className={className} aria-hidden>
      {/* pot */}
      <ellipse cx="100" cy="232" rx="54" ry="10" fill={gold ? "#A16207" : "#92400E"} opacity="0.25" />
      <path
        d="M58 180 L70 230 C72 238 128 238 130 230 L142 180 Z"
        fill={gold ? "#F59E0B" : "#E11D48"}
        stroke={gold ? "#B45309" : "#9F1239"}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="168"
        width="100"
        height="22"
        rx="8"
        fill={gold ? "#FBBF24" : "#FB7185"}
        stroke={gold ? "#B45309" : "#9F1239"}
        strokeWidth="4"
      />
      {/* soil */}
      <ellipse cx="100" cy="178" rx="40" ry="10" fill={gold ? "#A16207" : "#57534E"} />

      {stage >= 1 ? (
        <line
          x1="100"
          y1={178}
          x2="100"
          y2={178 - stemH}
          stroke={leaf}
          strokeWidth="6"
          strokeLinecap="round"
        />
      ) : null}

      {stage >= 2 ? (
        <>
          <ellipse
            cx="78"
            cy={178 - stemH * 0.45}
            rx="18"
            ry="9"
            fill={leaf}
            transform={`rotate(-28 78 ${178 - stemH * 0.45})`}
          />
          <ellipse
            cx="122"
            cy={178 - stemH * 0.6}
            rx="18"
            ry="9"
            fill={leaf}
            transform={`rotate(28 122 ${178 - stemH * 0.6})`}
          />
        </>
      ) : null}

      {stage === 3 ? (
        <ellipse
          cx="100"
          cy={178 - stemH - 6}
          rx="14"
          ry="18"
          fill={petal}
          stroke={petalDark}
          strokeWidth="3"
        />
      ) : null}

      {stage >= 4 ? (
        <g transform={`translate(100 ${178 - stemH})`}>
          {kind === "sunflower" ? (
            <>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy="-18"
                  rx="9"
                  ry="20"
                  fill={petal}
                  stroke={petalDark}
                  strokeWidth="2"
                  transform={`rotate(${deg})`}
                />
              ))}
              <circle cy="-4" r="14" fill={center} stroke={petalDark} strokeWidth="2.5" />
            </>
          ) : kind === "tulip" ? (
            <path
              d="M-22 8 C-22 -28 0 -40 0 -40 C0 -40 22 -28 22 8 Z"
              fill={petal}
              stroke={petalDark}
              strokeWidth="3"
            />
          ) : kind === "lavender" ? (
            <>
              {[-10, 10].map((x) =>
                [0, 1, 2, 3, 4, 5].map((i) => (
                  <circle
                    key={`${x}-${i}`}
                    cx={x}
                    cy={-8 - i * 9}
                    r="7"
                    fill={petal}
                    stroke={petalDark}
                    strokeWidth="1.5"
                  />
                )),
              )}
              <circle cy="-62" r="7" fill={petal} stroke={petalDark} strokeWidth="1.5" />
            </>
          ) : (
            <>
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy="-16"
                  rx="11"
                  ry="18"
                  fill={petal}
                  stroke={petalDark}
                  strokeWidth="2"
                  transform={`rotate(${deg})`}
                />
              ))}
              <circle cy="-2" r="10" fill={center} stroke={petalDark} strokeWidth="2.2" />
            </>
          )}
          {gold
            ? [0, 72, 144, 216, 288].map((deg) => (
                <g key={deg} transform={`rotate(${deg})`}>
                  <path d="M0 -48 L2 -56 L0 -64 L-2 -56 Z" fill="#FEF08A" />
                </g>
              ))
            : null}
        </g>
      ) : null}
    </svg>
  );
}

export function FlowerArt(props: FlowerProps) {
  return <GrowingPlantArt {...props} stage={props.stage ?? 4} />;
}
