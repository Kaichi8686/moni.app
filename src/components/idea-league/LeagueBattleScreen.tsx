"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { AiReviewCard } from "@/components/idea-league/AiReviewCard";
import { EmptyVoteState } from "@/components/idea-league/EmptyVoteState";
import { FriendMatchPanel } from "@/components/idea-league/FriendMatchPanel";
import { LeagueModeTabs, type LeaguePlayMode } from "@/components/idea-league/LeagueModeTabs";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueShell, leagueCardClass } from "@/components/idea-league/LeagueShell";
import { LeagueStatusCard } from "@/components/idea-league/LeagueStatusCard";
import { scheduleFor, voteWindow } from "@/lib/idea-league/calendar";
import type { LeagueBattleState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  battle: LeagueBattleState;
  publishedBattle?: LeagueBattleState | null;
  me: { userId: string; displayName: string };
  onSubmit: (input: { title: string; content: string; appeal?: string }) => Promise<void>;
  onVote: (submissionId: string) => Promise<void>;
  countdownActive?: boolean;
};

export function LeagueBattleScreen({
  battle,
  publishedBattle,
  me,
  onSubmit,
  countdownActive = true,
}: Props) {
  const { tx } = useI18n();
  const phase = battle.phase;
  const defaultTab = phase === "vote" ? "judge" : phase === "results" ? "board" : "prompt";
  const [playMode, setPlayMode] = useState<LeaguePlayMode>("league");
  const [tab, setTab] = useState<"board" | "prompt" | "judge">(defaultTab);
  const [title, setTitle] = useState(battle.mySubmission?.title ?? "");
  const [content, setContent] = useState(battle.mySubmission?.content ?? "");
  const [appeal, setAppeal] = useState(battle.mySubmission?.appeal ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sched = useMemo(() => scheduleFor(), []);
  const endsAt = phase === "submit" ? sched.submitEnd : voteWindow(battle.week.weekKey).endsAt;

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setErr(tx("タイトルと内容を入力してください", "Please enter a title and idea"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), appeal: appeal.trim() || undefined });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel =
    phase === "submit"
      ? tx("提出タイム", "Submit window")
      : phase === "vote"
        ? tx("AI判定タイム", "AI judgment")
        : tx("結果公表", "Results published");

  const countdownLabel =
    phase === "submit"
      ? tx("提出締切まで", "Until submit closes")
      : phase === "vote"
        ? tx("判定まで", "Until judgment ends")
        : tx("結果公表まで", "Until results");

  const myReview = battle.mySubmission?.aiReview ?? null;

  return (
    <LeagueShell
      sidebar={
        playMode === "league" ? (
          <LeagueStatusCard
            tier={battle.tier}
            phaseLabel={phaseLabel}
            countdownTarget={phase === "submit" || phase === "vote" ? endsAt : null}
            countdownLabel={countdownLabel}
            members={battle.members}
            promotionCutoff={battle.promotionCutoff}
            countdownActive={countdownActive}
          />
        ) : (
          <section className="rounded-2xl border border-teal-200/70 bg-gradient-to-b from-teal-50 to-white p-4 sm:p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-teal-700/80 uppercase">
              {tx("フレンドマッチ", "Friend Match")}
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
              {tx("カスタムルーム", "Custom room")}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {tx("招待コードで即対戦", "Join instantly with a code")}
            </p>
          </section>
        )
      }
    >
      <LeagueModeTabs mode={playMode} onChange={setPlayMode} />

      {playMode === "friend" ? (
        <FriendMatchPanel me={me} />
      ) : (
        <>
          <section className={leagueCardClass}>
            <p className="text-[11px] font-medium tracking-wide text-zinc-500">
              {tx("今週の共通お題", "This week's shared prompt")}
            </p>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
              {battle.week.promptTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{battle.week.promptBody}</p>
          </section>

          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-200/90 bg-white p-1">
            {(
              [
                ["prompt", phase === "submit" ? tx("提出", "Submit") : tx("お題", "Prompt")],
                ["judge", tx("判定", "Judge")],
                ["board", tx("結果", "Results")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-10 rounded-xl text-xs font-semibold transition sm:text-sm ${
                  tab === id ? "bg-[#FF9600] text-white" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

          {tab === "prompt" ? (
            phase === "submit" ? (
              <div className={`space-y-3 ${leagueCardClass}`}>
                <p className="text-sm text-zinc-600">
                  {tx(
                    "日曜朝11時まで提出できます。判定フェーズでAIが勝ち点とフィードバックを返します。",
                    "Submit until Sunday 11:00. In judgment, AI returns points and feedback.",
                  )}
                </p>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">{tx("タイトル", "Title")}</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:ring-0"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">{tx("アイデア", "Idea")}</span>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:ring-0"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">
                    {tx("ひとことアピール（任意）", "Short pitch (optional)")}
                  </span>
                  <input
                    value={appeal}
                    onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:ring-0"
                  />
                </label>
                <DuoButton
                  type="button"
                  tone="orange"
                  size="lg"
                  fullWidth
                  disabled={busy}
                  onClick={() => void handleSubmit()}
                >
                  {battle.mySubmission
                    ? tx("アイデアを更新する", "Update idea")
                    : tx("アイデアを投稿する", "Submit an idea")}
                </DuoButton>
              </div>
            ) : battle.mySubmission ? (
              <div className={leagueCardClass}>
                <p className="text-[11px] font-medium text-zinc-500">{tx("提出済み", "Submitted")}</p>
                <h3 className="mt-1 text-base font-bold text-zinc-900">{battle.mySubmission.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{battle.mySubmission.content}</p>
                <p className="mt-3 text-sm text-zinc-500">
                  {tx("提出期間は終了しました。判定タブでAI評価を確認できます。", "Submit closed — check AI review in Judge.")}
                </p>
              </div>
            ) : (
              <div className={`${leagueCardClass} text-center text-sm text-zinc-500`}>
                {tx(
                  "提出期間は終了しました。次のバトル週でアイデアを投稿できます。",
                  "Submit window closed. You can post in the next battle week.",
                )}
              </div>
            )
          ) : null}

          {tab === "judge" ? (
            phase === "submit" ? (
              battle.mySubmission ? (
                <div className={`${leagueCardClass} text-center`}>
                  <p className="text-sm font-semibold text-zinc-800">
                    {tx("提出済み — 判定待ち", "Submitted — awaiting judgment")}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {tx(
                      "日曜朝11時からAI審査が始まり、勝ち点とフィードバックが届きます。",
                      "AI review starts Sunday 11:00 with points and feedback.",
                    )}
                  </p>
                </div>
              ) : (
                <EmptyVoteState onSubmitIdea={() => setTab("prompt")} />
              )
            ) : !battle.mySubmission ? (
              <EmptyVoteState onSubmitIdea={() => setTab("prompt")} />
            ) : myReview ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">
                  {tx(
                    "初期フェーズはユーザー投票ではなく、AI審査（または運営判定）で勝ち点が決まります。",
                    "Early phase uses AI / ops review for points — not peer votes.",
                  )}
                </p>
                <AiReviewCard submission={battle.mySubmission} review={myReview} />
              </div>
            ) : (
              <div className={`${leagueCardClass} text-center text-sm text-zinc-500`}>
                {tx("AI審査を準備しています…", "Preparing AI review…")}
              </div>
            )
          ) : null}

          {tab === "board" ? (
            phase === "results" || phase === "vote" ? (
              <LeagueRankingBoard
                members={battle.members}
                tier={battle.tier}
                promotionCutoff={battle.promotionCutoff}
                title={
                  phase === "vote"
                    ? tx("暫定順位（AI勝ち点）", "Live board (AI points)")
                    : undefined
                }
              />
            ) : publishedBattle ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  {tx(
                    "今週の結果は水曜11時に公開。いまは先週の結果を表示しています。",
                    "This week’s results publish Wed 11:00. Showing last week for now.",
                  )}
                </p>
                <LeagueRankingBoard
                  members={publishedBattle.members}
                  tier={publishedBattle.tier}
                  promotionCutoff={publishedBattle.promotionCutoff}
                  title={tx("先週の結果", "Last week's results")}
                />
              </div>
            ) : (
              <div className={`${leagueCardClass} border-dashed text-center text-sm text-zinc-500`}>
                {tx(
                  "結果は水曜朝11時に公開されます。",
                  "Results publish Wednesday 11:00.",
                )}
              </div>
            )
          ) : null}

          {battle.members.length <= 1 ? (
            <p className="text-center text-[11px] text-zinc-400">
              {tx(
                "同じリーグに参加している登録ユーザーの順位が表示されます。",
                "Ranks show registered users in your league group.",
              )}
            </p>
          ) : null}
        </>
      )}
    </LeagueShell>
  );
}
