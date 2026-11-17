"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { PeerSolutions } from "@/components/office/play/PeerSolutions";
import { ResultComic } from "@/components/office/stage/ResultComic";
import { castMemberByRole, type CastMember } from "@/lib/office/cast";
import type { OfficeMeters } from "@/lib/office/meters";
import type { PeerSolution } from "@/lib/office/peers";
import { buildResultPanels, reactionForTone } from "@/lib/office/resultPanels";
import { METER_KEYS, METER_LABEL_JA, type OfficeSceneId } from "@/lib/office/scenes";
import type { IncidentType, OfficeCompany, OfficeSubmission } from "@/lib/office/types";

type Props = {
  submission: OfficeSubmission;
  company: OfficeCompany | null;
  codexBonus?: number;
  peerScene?: OfficeSceneId | null;
  peerType?: IncidentType | null;
  fetchPeers?: (scene: OfficeSceneId, type: IncidentType) => Promise<PeerSolution[]>;
  onVotePeer?: (id: string) => Promise<PeerSolution[]>;
  onReportPeer?: (id: string) => Promise<PeerSolution[]>;
  busy: boolean;
  onNext: () => void;
};

function MeterRow({
  label,
  from,
  to,
  delay,
  reduce,
}: {
  label: string;
  from: number;
  to: number;
  delay: number;
  reduce: boolean | null;
}) {
  const delta = to - from;
  const sign = delta > 0 ? "+" : "";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[12px] font-semibold text-zinc-600">
        <span>{label}</span>
        <span className="tabular-nums">
          {to}
          {delta !== 0 ? (
            <span
              className={`ml-1 text-[11px] font-bold ${
                delta > 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {sign}
              {delta}
            </span>
          ) : null}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-[#FF9600]"
          initial={reduce ? false : { width: `${from}%` }}
          animate={{ width: `${to}%` }}
          transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function ScoreBar({ label, value, delay }: { label: string; value: number; delay: number }) {
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

function metersBeforeFrom(
  after: OfficeMeters,
  delta: Partial<OfficeMeters> | null | undefined,
): OfficeMeters {
  const before = { ...after };
  if (!delta) return before;
  for (const key of METER_KEYS) {
    if (delta[key] == null) continue;
    before[key] = Math.max(0, Math.min(100, after[key] - (delta[key] as number)));
  }
  return before;
}

export function ResultStep({
  submission,
  company,
  codexBonus = 0,
  peerScene,
  peerType,
  fetchPeers,
  onVotePeer,
  onReportPeer,
  busy,
  onNext,
}: Props) {
  const reduce = useReducedMotion();
  const reaction = useMemo(
    () =>
      submission.npcLine && submission.reactionEmotion
        ? { line: submission.npcLine, emotion: submission.reactionEmotion }
        : reactionForTone(submission.storyTone),
    [submission.npcLine, submission.reactionEmotion, submission.storyTone],
  );

  const panels = useMemo(() => {
    if (submission.panels?.length === 3) return submission.panels;
    return buildResultPanels({
      incidentTitle: "事件",
      strategyTitle: submission.strategyTitle ?? "作戦",
      targetLabels: [],
      story: submission.story,
      storyTone: submission.storyTone,
      comment: submission.comment,
    });
  }, [submission]);

  const speaker: CastMember | null = useMemo(() => {
    if (!company?.cast?.length) return null;
    if (submission.castMemberId) {
      return company.cast.find((c) => c.id === submission.castMemberId) ?? company.cast[0]!;
    }
    return castMemberByRole(company.cast, "secretary") ?? company.cast[0]!;
  }, [company, submission.castMemberId]);

  const metersAfter = company?.meters ?? null;
  const metersBefore = useMemo(
    () =>
      metersAfter
        ? metersBeforeFrom(metersAfter, submission.metersDelta)
        : null,
    [metersAfter, submission.metersDelta],
  );

  const [phase, setPhase] = useState<"comic" | "reveal" | "done">(
    reduce ? "done" : "comic",
  );
  const [coin, setCoin] = useState(reduce ? submission.revenue : 0);
  const [showMeters, setShowMeters] = useState(Boolean(reduce));

  const onComicDone = useCallback(() => {
    setPhase((p) => (p === "comic" ? "reveal" : p));
  }, []);

  useEffect(() => {
    if (phase !== "reveal" || reduce) {
      if (reduce) {
        setCoin(submission.revenue);
        setShowMeters(true);
        setPhase("done");
      }
      return;
    }
    setShowMeters(true);
    const start = performance.now();
    const dur = 700;
    const from = 0;
    const to = submission.revenue;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setCoin(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPhase("done");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduce, submission.revenue]);

  function skipAll() {
    setPhase("done");
    setShowMeters(true);
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
      className={`space-y-4 rounded-3xl border p-4 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md sm:p-5 ${
        submission.storyTone === "great"
          ? "border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white/90 to-amber-50/90"
          : submission.storyTone === "bitter"
            ? "border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/90 to-orange-50/90"
            : "border-sky-200/70 bg-gradient-to-br from-sky-50/95 via-white/90 to-amber-50/90"
      }`}
      onClick={phase !== "done" ? skipAll : undefined}
      role="presentation"
    >
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          {phase === "comic" ? "結果をまとめてる…" : toneLabel}
        </p>
        {phase !== "comic" ? (
          <motion.p
            className="office-coin-pop mt-2 text-4xl font-black tabular-nums text-emerald-700"
            initial={reduce ? false : { scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            +{coin.toLocaleString("ja-JP")}
            <span className="ml-1 text-base font-bold">コイン</span>
          </motion.p>
        ) : null}
        {submission.wasSimilar ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            似た提出だったから売上30%になったよ
          </p>
        ) : null}
        {submission.isOriginal ? (
          <p className="mt-1 text-xs font-semibold text-[#FF9600]">自分の作戦ボーナス +10%</p>
        ) : null}
        {codexBonus > 0 ? (
          <p className="mt-1 text-xs font-semibold text-amber-800">
            図鑑ボーナス +{codexBonus.toLocaleString("ja-JP")}
          </p>
        ) : null}
      </div>

      <ResultComic
        panels={panels}
        speaker={speaker}
        reactionEmotion={reaction.emotion}
        npcLine={reaction.line}
        onComplete={onComicDone}
      />

      {showMeters && metersAfter && metersBefore ? (
        <div className="space-y-2.5 rounded-xl bg-white/80 p-3 ring-1 ring-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400">会社メーター</p>
          {METER_KEYS.map((key, i) => (
            <MeterRow
              key={key}
              label={METER_LABEL_JA[key]}
              from={metersBefore[key]}
              to={metersAfter[key]}
              delay={0.05 + i * 0.08}
              reduce={reduce}
            />
          ))}
        </div>
      ) : null}

      {phase === "done" ? (
        <>
          <div className="space-y-3 rounded-xl bg-white/80 p-3 ring-1 ring-zinc-100">
            <ScoreBar label="解決力" value={submission.scoreSolve} delay={0.05} />
            <ScoreBar label="おもしろさ" value={submission.scoreFun} delay={0.1} />
            <ScoreBar label="実現できそう" value={submission.scoreFeasible} delay={0.15} />
            <ScoreBar label="作戦フィット" value={submission.scoreFit} delay={0.2} />
            <p className="pt-1 text-center text-sm font-bold tabular-nums text-zinc-800">
              総合 {submission.scoreTotal} 点
              <span className="ml-2 text-[11px] font-semibold text-zinc-400">
                ×{submission.multiplier.toFixed(2)}
              </span>
            </p>
          </div>
          <p className="text-center text-sm leading-relaxed text-zinc-700">{submission.comment}</p>
          {submission.nextHint ? (
            <p className="text-center text-[11px] font-medium text-zinc-500">
              ヒント: {submission.nextHint}
            </p>
          ) : null}
          {peerScene && peerType && fetchPeers && onVotePeer && onReportPeer ? (
            <PeerSolutions
              scene={peerScene}
              type={peerType}
              fetchPeers={fetchPeers}
              onVote={onVotePeer}
              onReport={onReportPeer}
            />
          ) : null}
          <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={onNext}>
            {busy ? "準備中…" : "次の事件へ"}
          </DuoButton>
        </>
      ) : null}
    </section>
  );
}
