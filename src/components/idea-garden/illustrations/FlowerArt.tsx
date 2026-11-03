"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  if (c === "#78350F") return "#92400E";
  if (c === "#F8FAFC" || c === "#F5F3FF" || c === "#FEF3C7" || c === "#FCE7F3") return "#FEF3C7";
  return "#FBBF24";
}

const STEM_H = [0, 28, 70, 95, 110] as const;

const softSpring = { type: "spring" as const, stiffness: 48, damping: 14, mass: 0.9 };
const softAppear = { type: "spring" as const, stiffness: 70, damping: 16, mass: 0.7 };

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

function BloomHead({
  kind,
  petal,
  petalDark,
  center,
  gold,
}: {
  kind: FlowerKind;
  petal: string;
  petalDark: string;
  center: string;
  gold?: boolean;
}) {
  if (kind === "sunflower") {
    return (
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
    );
  }
  if (kind === "tulip") {
    return (
      <path
        d="M-22 8 C-22 -28 0 -40 0 -40 C0 -40 22 -28 22 8 Z"
        fill={petal}
        stroke={petalDark}
        strokeWidth="3"
      />
    );
  }
  if (kind === "lavender") {
    return (
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
    );
  }
  return (
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
  );
}

/** 鉢付きの成長アニメ用フラワー（ゆるっと伸びる） */
export function GrowingPlantArt({ kind, stage = 4, gold, className = "" }: FlowerProps) {
  const p = PALETTE[kind];
  const petal = goldify(p.petal, gold);
  const petalDark = goldify(p.petalDark, gold);
  const center = goldify(p.center, gold);
  const leaf = gold ? "#CA8A04" : p.leaf;
  const stemH = STEM_H[stage] ?? 110;
  const growing = stage > 0 && stage < 4;

  return (
    <motion.svg
      viewBox="0 0 200 260"
      className={className}
      aria-hidden
      style={{ originX: "100px", originY: "232px", transformBox: "fill-box", transformOrigin: "50% 90%" }}
      animate={
        growing
          ? { rotate: [0, -1.4, 1.1, -0.7, 0.4, 0] }
          : { rotate: 0 }
      }
      transition={
        growing
          ? { duration: 2.8, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }
          : { duration: 0.6 }
      }
    >
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
      <ellipse cx="100" cy="178" rx="40" ry="10" fill={gold ? "#A16207" : "#57534E"} />

      {/* stem — ゆるく伸びる */}
      <motion.line
        x1="100"
        y1={178}
        x2="100"
        initial={false}
        animate={{ y2: 178 - stemH, opacity: stage >= 1 ? 1 : 0 }}
        transition={softSpring}
        stroke={leaf}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* leaves — その場でうっすら出現（スライドなし） */}
      <AnimatePresence>
        {stage >= 2 ? (
          <motion.g key="leaves" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.g
              initial={{ opacity: 0, scale: 0.94, y: -(stemH * 0.45) }}
              animate={{ opacity: 1, scale: 1, y: -(stemH * 0.45) }}
              transition={{ opacity: { duration: 0.55, ease: "easeOut" }, scale: softAppear, y: softSpring }}
              style={{ originX: "78px", originY: "178px" }}
            >
              <ellipse cx="78" cy="178" rx="18" ry="9" fill={leaf} transform="rotate(-28 78 178)" />
            </motion.g>
            <motion.g
              initial={{ opacity: 0, scale: 0.94, y: -(stemH * 0.6) }}
              animate={{ opacity: 1, scale: 1, y: -(stemH * 0.6) }}
              transition={{
                opacity: { duration: 0.55, ease: "easeOut", delay: 0.06 },
                scale: { ...softAppear, delay: 0.06 },
                y: softSpring,
              }}
              style={{ originX: "122px", originY: "178px" }}
            >
              <ellipse cx="122" cy="178" rx="18" ry="9" fill={leaf} transform="rotate(28 122 178)" />
            </motion.g>
          </motion.g>
        ) : null}
      </AnimatePresence>

      {/* bud → bloom — その場でうっすら */}
      <AnimatePresence mode="wait">
        {stage === 3 ? (
          <motion.g
            key="bud"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.5, ease: "easeOut" }, scale: softAppear }}
            style={{ originX: "100px", originY: `${178 - stemH - 6}px` }}
          >
            <ellipse
              cx="100"
              cy={178 - stemH - 6}
              rx="14"
              ry="18"
              fill={petal}
              stroke={petalDark}
              strokeWidth="3"
            />
          </motion.g>
        ) : null}
        {stage >= 4 ? (
          <g key="bloom" transform={`translate(100 ${178 - stemH})`}>
            <motion.g
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ opacity: { duration: 0.55, ease: "easeOut" }, scale: softAppear }}
            >
              <BloomHead
                kind={kind}
                petal={petal}
                petalDark={petalDark}
                center={center}
                gold={gold}
              />
              {gold
                ? [0, 72, 144, 216, 288].map((deg) => (
                    <g key={`spark-${deg}`} transform={`rotate(${deg})`}>
                      <path d="M0 -48 L2 -56 L0 -64 L-2 -56 Z" fill="#FEF08A" />
                    </g>
                  ))
                : null}
            </motion.g>
          </g>
        ) : null}
      </AnimatePresence>
    </motion.svg>
  );
}

export function FlowerArt(props: FlowerProps) {
  return <GrowingPlantArt {...props} stage={props.stage ?? 4} />;
}
