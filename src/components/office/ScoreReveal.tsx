"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import type { OfficeSubmission } from "@/lib/office/types";

type Props = {
  submission: OfficeSubmission;
  busy: boolean;
  onNext: () => void;
};

function Bar({ label, value, delay }: { label: string; value: number; delay: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px] font-semibold text-zinc-600">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="h-full rounded-full bg-[#FF9600]"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function ScoreReveal({ submission, busy, onNext }: Props) {
  const reduce = useReducedMotion();
  const sentences = useMemo(() => {
    const raw = submission.story?.trim() || submission.comment;
    return raw
      .split(/(?<=[。！？])/u)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  }, [submission.story, submission.comment]);

  const [phase, setPhase] = useState<"loading" | "story" | "scores" | "done">(
    reduce ? "done" : "loading",
  );
  const [storyCount, setStoryCount] = useState(reduce ? sentences.length : 0);
  const [coin, setCoin] = useState(reduce ? submission.revenue : 0);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("story"), 700));
    sentences.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setStoryCount(i + 1);
          if (i === sentences.length - 1) setPhase("scores");
        }, 900 + i * 700),
      );
    });
    const scoreAt = 900 + Math.max(sentences.length, 1) * 700;
    timers.push(
      window.setTimeout(() => {
        setPhase("done");
        const start = performance.now();
        const dur = 700;
        const from = 0;
        const to = submission.revenue;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          setCoin(Math.round(from + (to - from) * t));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, scoreAt + 400),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reduce, sentences, submission.revenue]);

  function skip() {
    setPhase("done");
    setStoryCount(sentences.length);
    setCoin(submission.revenue);
  }

  const toneLabel =
    submission.storyTone === "great"
      ? "大成功！"
      : submission.storyTone === "bitter"
        ? "ほろ苦い結果"
        : "まずまずの結果";

  return (
    <section
      className={`space-y-5 rounded-3xl border p-5 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md sm:p-6 ${
        submission.storyTone === "great"
          ? "border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white/90 to-amber-50/90"
          : submission.storyTone === "bitter"
            ? "border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/90 to-orange-50/90"
            : "border-sky-200/70 bg-gradient-to-br from-sky-50/95 via-white/90 to-amber-50/90"
      }`}
      onClick={phase !== "done" ? skip : undefined}
      role="presentation"
    >
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          {phase === "loading" ? "結果をまとめてる…" : toneLabel}
        </p>
        {phase === "loading" ? (
          <p className="mt-3 text-sm font-semibold text-zinc-600">社員が作戦を振り返中</p>
        ) : (
          <motion.p
            className="mt-2 text-4xl font-black tabular-nums text-emerald-700"
            initial={reduce ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            +{coin.toLocaleString("ja-JP")}
            <span className="ml-1 text-base font-bold">コイン</span>
          </motion.p>
        )}
        {submission.wasSimilar ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            似た提出だったから売上30%になったよ
          </p>
        ) : null}
        {submission.isOriginal ? (
          <p className="mt-1 text-xs font-semibold text-[#FF9600]">自分の作戦ボーナス +10%</p>
        ) : null}
      </div>

      {phase !== "loading" ? (
        <div className="space-y-2 rounded-xl bg-white/80 p-3 ring-1 ring-zinc-100">
          {sentences.slice(0, storyCount).map((line, i) => (
            <motion.p
              key={`${i}-${line.slice(0, 8)}`}
              className="text-sm leading-relaxed text-zinc-700"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {line}
            </motion.p>
          ))}
          {storyCount < sentences.length ? (
            <p className="text-[11px] font-medium text-zinc-400">タップでスキップ</p>
          ) : null}
        </div>
      ) : null}

      {phase === "scores" || phase === "done" ? (
        <div className="space-y-3 rounded-xl bg-white/80 p-3 ring-1 ring-zinc-100">
          <Bar label="解決力" value={submission.scoreSolve} delay={0.05} />
          <Bar label="おもしろさ" value={submission.scoreFun} delay={0.1} />
          <Bar label="実現できそう" value={submission.scoreFeasible} delay={0.15} />
          <Bar label="作戦フィット" value={submission.scoreFit} delay={0.2} />
          <p className="pt-1 text-center text-sm font-bold tabular-nums text-zinc-800">
            総合 {submission.scoreTotal} 点
            <span className="ml-2 text-[11px] font-semibold text-zinc-400">
              ×{submission.multiplier.toFixed(2)}
            </span>
          </p>
        </div>
      ) : null}

      {phase === "done" ? (
        <>
          <p className="text-center text-sm leading-relaxed text-zinc-700">{submission.comment}</p>
          {submission.nextHint ? (
            <p className="text-center text-[11px] font-medium text-zinc-500">
              ヒント: {submission.nextHint}
            </p>
          ) : null}
          <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={onNext}>
            {busy ? "準備中…" : "次の事件へ"}
          </DuoButton>
        </>
      ) : null}
    </section>
  );
}
