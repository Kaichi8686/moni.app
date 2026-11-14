"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { getTutorialPrompt } from "@/lib/idea-league/api";
import type { LeagueTutorialResult } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { burstCelebration } from "@/lib/ui/confetti";

type Props = {
  onComplete: (input: { title: string; content: string }) => Promise<LeagueTutorialResult>;
  onFinished: () => void;
};

type Step = "intro" | "write" | "result";

const STEP_INDEX: Record<Step, number> = { intro: 0, write: 1, result: 2 };

function TutorialProgress({ step, labels }: { step: Step; labels: [string, string, string] }) {
  const active = STEP_INDEX[step];
  return (
    <ol className="flex items-center justify-center gap-1.5 sm:gap-2" aria-label="tutorial progress">
      {labels.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums transition-colors ${
                current
                  ? "bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]"
                  : done
                    ? "bg-amber-100 text-amber-800"
                    : "bg-zinc-100 text-zinc-400"
              }`}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`whitespace-nowrap text-[11px] font-semibold ${
                current ? "text-zinc-900" : done ? "text-amber-800/80" : "text-zinc-400"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 ? (
              <span
                className={`mx-0.5 h-px w-4 shrink-0 sm:mx-1 sm:w-8 ${done ? "bg-amber-300" : "bg-zinc-200"}`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function LeagueTutorialFlow({ onComplete, onFinished }: Props) {
  const { tx } = useI18n();
  const prompt = getTutorialPrompt();
  const [step, setStep] = useState<Step>("intro");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeagueTutorialResult | null>(null);
  const [err, setErr] = useState("");

  const progressLabels: [string, string, string] = [
    tx("はじめる", "Start"),
    tx("書く", "Write"),
    tx("結果", "Result"),
  ];

  const practiceSteps = [
    {
      n: "1",
      title: tx("お題を読む", "Read the prompt"),
      body: tx("共通課題に目を通す", "Skim today’s shared challenge"),
    },
    {
      n: "2",
      title: tx("アイデアを出す", "Submit an idea"),
      body: tx("タイトルと本文を書いて提出", "Write a title and short pitch"),
    },
    {
      n: "3",
      title: tx("順位を見る", "See the board"),
      body: tx("模擬ランキングで流れを体験", "Preview ranking flow once"),
    },
  ];

  async function submit() {
    if (!title.trim() || !content.trim()) {
      setErr(tx("タイトルと内容を入力してください", "Please enter a title and idea"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await onComplete({ title: title.trim(), content: content.trim() });
      setResult(res);
      setStep("result");
      burstCelebration();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-lg overflow-hidden px-4 pb-28 pt-3">
      {/* Soft bronze atmosphere — matches Idea League entry tier */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 h-72 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(255, 150, 0, 0.16) 0%, rgba(251, 191, 36, 0.08) 42%, transparent 72%)",
        }}
      />

      <div className="relative space-y-5">
        <TutorialProgress step={step} labels={progressLabels} />

        <AnimatePresence mode="wait">
          {step === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              <header className="pt-2 text-center">
                <motion.div
                  className="mx-auto flex justify-center"
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.06, type: "spring", stiffness: 260, damping: 18 }}
                >
                  <LeagueTierBadge tier="bronze" size="lg" showLabel={false} animated flat />
                </motion.div>
                <motion.p
                  className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#B45309]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Idea League
                </motion.p>
                <motion.h1
                  className="mt-2 font-[family-name:var(--font-instrument-serif)] text-[2rem] leading-[1.15] tracking-tight text-zinc-900 sm:text-[2.35rem]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                >
                  {tx("本番の前に、1回だけ練習", "One practice before battle")}
                </motion.h1>
                <motion.p
                  className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-600"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                >
                  {tx(
                    "お題にアイデアを出して、模擬ランキングまで体験します。本番の順位には入りません。",
                    "Submit to a prompt and preview a mock ranking. This run won’t affect real standings.",
                  )}
                </motion.p>
              </header>

              <motion.ol
                className="space-y-2.5"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.07, delayChildren: 0.22 } },
                }}
              >
                {practiceSteps.map((item) => (
                  <motion.li
                    key={item.n}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0 },
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-amber-100/90 bg-white/90 px-3.5 py-3 shadow-[0_1px_0_rgba(180,83,9,0.06)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#FFE0A8] to-[#FFCC7A] text-sm font-black text-[#9A5B1F] shadow-[0_2px_0_#F0B85A]">
                      {item.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{item.body}</p>
                    </div>
                  </motion.li>
                ))}
              </motion.ol>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
                className="space-y-3 pt-1"
              >
                <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={() => setStep("write")}>
                  {tx("練習をはじめる", "Start practice")}
                </DuoButton>
                <p className="text-center text-[11px] font-medium text-zinc-400">
                  {tx("所要1〜2分 · スキップ不可", "About 1–2 min · required once")}
                </p>
              </motion.div>
            </motion.div>
          ) : null}

          {step === "write" ? (
            <motion.div
              key="write"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="border-b border-amber-100 bg-gradient-to-r from-[#FFF7E8] to-white px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9600]">
                    {tx("共通課題 · 練習", "Shared challenge · practice")}
                  </p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{prompt.title}</h2>
                </div>
                <p className="px-4 py-3 text-sm leading-relaxed text-zinc-600">{prompt.body}</p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-600">
                      {tx("タイトル（40字以内）", "Title (max 40)")}
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-400">{title.length}/40</span>
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none transition-shadow ring-[#FF9600] focus:ring-2"
                    placeholder={tx("例: ポケット仕切りアプリ", "e.g. Pocket sorter app")}
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-zinc-600">{tx("アイデア本文", "Your idea")}</span>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="mt-1 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition-shadow ring-[#FF9600] focus:ring-2"
                    placeholder={tx("自由に書いてOK。ラフで大丈夫です。", "Write freely — rough ideas welcome.")}
                  />
                </label>
              </div>

              {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

              <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={() => void submit()}>
                {busy ? tx("提出中…", "Submitting…") : tx("提出して模擬ランキングを見る", "Submit & see mock ranking")}
              </DuoButton>
            </motion.div>
          ) : null}

          {step === "result" && result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-6 text-center">
                <motion.div
                  className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-200/40 blur-2xl"
                  aria-hidden
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700/80">
                  {tx("模擬ランキング", "Mock ranking")}
                </p>
                <motion.p
                  className="mt-2 text-4xl font-black tabular-nums text-emerald-700"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.08 }}
                >
                  #{result.mockRank}
                </motion.p>
                <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-snug text-emerald-900/80">
                  {tx(
                    "練習完了！本日のお題から本番リーグに参加できます。",
                    "Practice done! You can join today's battle now.",
                  )}
                </p>
              </div>
              <LeagueRankingBoard
                members={result.mockBoard}
                tier="bronze"
                title={tx("チュートリアル順位（参考）", "Tutorial board (sample)")}
              />
              <p className="text-center text-xs font-medium text-zinc-500">
                {tx(
                  "本番では仲間のアイデアに1票投票し、上位3名が昇格します。",
                  "In the real battle, cast one peer vote — top 3 promote.",
                )}
              </p>
              <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onFinished}>
                {tx("リーグへ進む", "Enter the league")}
              </DuoButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
