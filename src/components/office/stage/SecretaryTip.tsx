"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { CastFigure } from "@/components/office/stage/CastFigure";
import type { CastMember } from "@/lib/office/cast";

const TIPS = [
  {
    title: "事件が起きたら",
    body: "まずステージの社員の声を聞いてね。放置するとメーターが危ないよ。",
  },
  {
    title: "進め方",
    body: "作戦 → ターゲット → 実行の3ステップ。迷ったら安全寄りでもOK。",
  },
  {
    title: "メーターと連続",
    body: "お客・士気・評判・資金を守ると売上アップ。毎日来ると連続ボーナスも。",
  },
] as const;

type Props = {
  secretary: CastMember;
  loginStreak: number;
  onDone: () => void;
};

export function SecretaryTip({ secretary, loginStreak, onDone }: Props) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const tip = TIPS[idx]!;
  const last = idx >= TIPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center">
      <motion.div
        className="w-full max-w-[480px] overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-b from-white to-amber-50 shadow-[0_24px_64px_rgba(28,25,23,0.28)]"
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        role="dialog"
        aria-labelledby="office-secretary-title"
      >
        <div className="flex items-end gap-3 px-4 pt-4">
          <div className="h-24 w-16 shrink-0">
            <CastFigure member={secretary} emotion="happy" enter={!reduce} />
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
              秘書ガイド
            </p>
            <h2 id="office-secretary-title" className="text-lg font-black text-zinc-900">
              {secretary.name}
            </h2>
            {loginStreak > 0 ? (
              <p className="mt-1 text-xs font-bold text-[#FF9600]">
                連続ログイン {loginStreak} 日目
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4 pt-2">
          <div className="rounded-2xl border border-zinc-100 bg-white px-3.5 py-3 shadow-sm">
            <p className="text-sm font-black text-zinc-900">{tip.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{tip.body}</p>
          </div>
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            {TIPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === idx ? "bg-[#FF9600]" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
          <DuoButton
            type="button"
            tone="orange"
            size="lg"
            fullWidth
            onClick={() => {
              if (last) onDone();
              else setIdx((v) => v + 1);
            }}
          >
            {last ? "はじめる" : "次へ"}
          </DuoButton>
        </div>
      </motion.div>
    </div>
  );
}
