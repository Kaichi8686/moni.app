"use client";

import { motion } from "framer-motion";
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
          transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export function ScoreReveal({ submission, busy, onNext }: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700/80">
          採点結果
        </p>
        <motion.p
          className="mt-2 text-4xl font-black tabular-nums text-emerald-700"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          +{submission.revenue.toLocaleString("ja-JP")}
          <span className="ml-1 text-base font-bold">コイン</span>
        </motion.p>
        {submission.wasSimilar ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            似た提出だったから売上30%になったよ
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl bg-white/80 p-3 ring-1 ring-zinc-100">
        <Bar label="解決力" value={submission.scoreSolve} delay={0.05} />
        <Bar label="おもしろさ" value={submission.scoreFun} delay={0.12} />
        <Bar label="実現できそう" value={submission.scoreFeasible} delay={0.19} />
        <p className="pt-1 text-center text-sm font-bold tabular-nums text-zinc-800">
          総合 {submission.scoreTotal} 点
        </p>
      </div>

      <p className="text-center text-sm leading-relaxed text-zinc-700">{submission.comment}</p>

      <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={onNext}>
        {busy ? "準備中…" : "次の事件へ"}
      </DuoButton>
    </section>
  );
}
