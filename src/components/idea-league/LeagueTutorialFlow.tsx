"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { getTutorialPrompt } from "@/lib/idea-league/api";
import type { LeagueTutorialResult } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { burstCelebration } from "@/lib/ui/confetti";

type Props = {
  onComplete: (input: { title: string; content: string }) => Promise<LeagueTutorialResult>;
  onFinished: () => void;
};

export function LeagueTutorialFlow({ onComplete, onFinished }: Props) {
  const { tx } = useI18n();
  const prompt = getTutorialPrompt();
  const [step, setStep] = useState<"intro" | "write" | "result">("intro");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeagueTutorialResult | null>(null);
  const [err, setErr] = useState("");

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
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <AnimatePresence mode="wait">
        {step === "intro" ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="rounded-[28px] bg-gradient-to-br from-[#1e293b] via-[#312e81] to-[#0f172a] p-5 text-white shadow-[0_12px_0_#0f172a]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
                {tx("初回チュートリアル", "First-time tutorial")}
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight tracking-tight">
                {tx("アイデアリーグへようこそ", "Welcome to Idea League")}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                {tx(
                  "本番の土曜バトルの前に、必ず1回だけ練習します。共通の課題にアイデアを出し、模擬ランキングで流れを体験しましょう。",
                  "Before your first Saturday battle, complete one practice round: submit to a shared prompt and see a mock ranking.",
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-zinc-100">
                <li>・{tx("毎週土曜だけの共通お題バトル", "Shared prompt battles — Saturdays only")}</li>
                <li>・{tx("グループ内で相互投票", "Peer voting inside your group")}</li>
                <li>・{tx("上位3名が次のリーグへ昇格", "Top 3 promote to the next league")}</li>
              </ul>
            </div>
            <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={() => setStep("write")}>
              {tx("練習をはじめる", "Start practice")}
            </DuoButton>
          </motion.div>
        ) : null}

        {step === "write" ? (
          <motion.div
            key="write"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="rounded-3xl bg-white p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9600]">
                {tx("共通課題", "Shared challenge")}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{prompt.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{prompt.body}</p>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-zinc-600">{tx("タイトル（40字以内）", "Title (max 40)")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
                placeholder={tx("例: ポケット仕切りアプリ", "e.g. Pocket sorter app")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-600">{tx("アイデア本文", "Your idea")}</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-relaxed outline-none ring-[#FF9600] focus:ring-2"
                placeholder={tx("自由に書いてOK。ラフで大丈夫です。", "Write freely — rough ideas welcome.")}
              />
            </label>
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
            className="space-y-4"
          >
            <div className="rounded-3xl bg-emerald-600 px-4 py-5 text-center text-white shadow-[0_10px_0_#047857]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                {tx("模擬ランキング", "Mock ranking")}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums">#{result.mockRank}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-50">
                {tx(
                  "練習完了！次の土曜から本番リーグに参加できます。",
                  "Practice done! You're ready for the next Saturday battle.",
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
  );
}
