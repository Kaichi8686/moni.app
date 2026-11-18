"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CastFigure } from "@/components/office/stage/CastFigure";
import type { CastMember } from "@/lib/office/cast";
import type { ResultPanel } from "@/lib/office/resultPanels";
import type { CastEmotion } from "@/lib/office/scenes";

type Props = {
  panels: ResultPanel[];
  speaker: CastMember | null;
  reactionEmotion?: CastEmotion | null;
  npcLine?: string | null;
  onComplete?: () => void;
};

/**
 * 結果3コマ：状況 → 作戦 → 結果。タップでスキップ可。
 */
export function ResultComic({
  panels,
  speaker,
  reactionEmotion,
  npcLine,
  onComplete,
}: Props) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? panels.length : 0);

  useEffect(() => {
    if (reduce) {
      onComplete?.();
      return;
    }
    const timers: number[] = [];
    panels.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setVisible(i + 1);
          if (i === panels.length - 1) onComplete?.();
        }, 280 + i * 520),
      );
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [panels, reduce, onComplete]);

  function skip() {
    setVisible(panels.length);
    onComplete?.();
  }

  return (
    <div
      className="space-y-2"
      onClick={visible < panels.length ? skip : undefined}
      role="presentation"
    >
      <div className="grid grid-cols-3 gap-2">
        {panels.map((panel, i) => {
          const show = i < visible;
          const isOutcome = panel.kind === "outcome";
          const emotion =
            (isOutcome ? reactionEmotion : null) ?? panel.emotion ?? null;
          return (
            <motion.article
              key={`${panel.kind}-${i}`}
              className={`relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-white to-amber-50/60 p-2 ring-1 ring-amber-100/80 ${
                show ? "office-comic-panel" : "opacity-0"
              } ${
                isOutcome
                  ? "border-amber-200"
                  : panel.kind === "choice"
                    ? "border-sky-100"
                    : "border-zinc-100"
              }`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold tracking-wide text-zinc-400">
                {panel.caption}
              </p>
              <div className="mt-1 flex flex-1 flex-col items-center justify-end">
                {speaker ? (
                  <div className="h-14 w-auto">
                    <CastFigure
                      member={speaker}
                      emotion={emotion}
                      enter={show && !reduce}
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-amber-100" aria-hidden />
                )}
                <p className="mt-1 line-clamp-3 text-center text-[11px] font-semibold leading-snug text-zinc-700">
                  {panel.body}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
      {visible >= panels.length && npcLine ? (
        <motion.p
          className="rounded-2xl border border-zinc-100 bg-white px-3 py-2 text-center text-sm font-bold text-zinc-700 shadow-sm"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {npcLine}
        </motion.p>
      ) : visible < panels.length ? (
        <p className="text-center text-[11px] font-medium text-zinc-400">
          タップでスキップ
        </p>
      ) : null}
    </div>
  );
}
