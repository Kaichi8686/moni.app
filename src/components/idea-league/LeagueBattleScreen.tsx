"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { AiReviewCard } from "@/components/idea-league/AiReviewCard";
import { EmptyVoteState } from "@/components/idea-league/EmptyVoteState";
import { FriendMatchPanel } from "@/components/idea-league/FriendMatchPanel";
import { HowToEarnPoints } from "@/components/idea-league/HowToEarnPoints";
import { LeagueModeTabs, type LeaguePlayMode } from "@/components/idea-league/LeagueModeTabs";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueShell, leagueCardClass } from "@/components/idea-league/LeagueShell";
import { LeagueStatusCard } from "@/components/idea-league/LeagueStatusCard";
import { scheduleFor } from "@/lib/idea-league/calendar";
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
  const defaultTab = phase === "results" ? "board" : "prompt";
  const [playMode, setPlayMode] = useState<LeaguePlayMode>("league");
  const [tab, setTab] = useState<"board" | "prompt" | "judge">(defaultTab);
  const [title, setTitle] = useState(battle.mySubmission?.title ?? "");
  const [content, setContent] = useState(battle.mySubmission?.content ?? "");
  const [appeal, setAppeal] = useState(battle.mySubmission?.appeal ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const sched = useMemo(() => scheduleFor(), []);
  const endsAt = sched.submitEnd;
  const myScore = battle.members.find((m) => m.isMe)?.voteScore ?? 0;
  const myReview = battle.mySubmission?.aiReview ?? null;

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setErr(tx("タイトルと内容を入力してください", "Please enter a title and idea"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), appeal: appeal.trim() || undefined });
      setTab("judge");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LeagueShell
      sidebar={
        playMode === "league" ? (
          <LeagueStatusCard
            tier={battle.tier}
            phaseLabel={tx("本日のバトル", "Today's battle")}
            countdownTarget={endsAt}
            countdownLabel={tx("締切まで", "Until close")}
            members={battle.members}
            promotionCutoff={battle.promotionCutoff}
            countdownActive={countdownActive}
            onEarnPoints={() => {
              setPlayMode("league");
              setTab("prompt");
            }}
          />
        ) : (
          <section className={leagueCardClass}>
            <p className="text-[11px] font-medium text-zinc-500">{tx("フレンドマッチ", "Friend Match")}</p>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">{tx("ルーム", "Room")}</h1>
          </section>
        )
      }
    >
      <LeagueModeTabs mode={playMode} onChange={setPlayMode} />

      {playMode === "friend" ? (
        <FriendMatchPanel me={me} />
      ) : (
        <>
          {!battle.mySubmission || myScore === 0 ? (
            <HowToEarnPoints onStart={() => setTab("prompt")} />
          ) : null}

          <section className={leagueCardClass}>
            <p className="text-[11px] font-medium text-zinc-500">
              {tx("本日のお題", "Today's prompt")}
            </p>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-zinc-900">
              {battle.week.promptTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{battle.week.promptBody}</p>
          </section>

          <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
            {(
              [
                ["prompt", tx("提出", "Submit")],
                ["judge", tx("採点", "Score")],
                ["board", tx("順位", "Board")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-10 rounded-lg text-sm font-semibold transition ${
                  tab === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

          {tab === "prompt" ? (
            <div className={`space-y-3 ${leagueCardClass}`}>
              <p className="text-sm text-zinc-500">
                {tx("次の11時まで提出可。送るとすぐptが付きます。", "Open until next 11:00. Submit for instant pt.")}
              </p>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">{tx("タイトル", "Title")}</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">{tx("アイデア", "Idea")}</span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">
                  {tx("ひとこと（任意）", "Pitch (optional)")}
                </span>
                <input
                  value={appeal}
                  onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400"
                />
              </label>
              <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={() => void handleSubmit()}>
                {battle.mySubmission ? tx("更新して再採点", "Update & re-score") : tx("提出する", "Submit")}
              </DuoButton>
            </div>
          ) : null}

          {tab === "judge" ? (
            !battle.mySubmission ? (
              <EmptyVoteState onSubmitIdea={() => setTab("prompt")} />
            ) : myReview ? (
              <AiReviewCard submission={battle.mySubmission} review={myReview} />
            ) : (
              <p className={`${leagueCardClass} text-center text-sm text-zinc-500`}>
                {tx("採点を準備しています…", "Preparing score…")}
              </p>
            )
          ) : null}

          {tab === "board" ? (
            <div className="space-y-3">
              <LeagueRankingBoard
                members={battle.members}
                tier={battle.tier}
                promotionCutoff={battle.promotionCutoff}
                title={tx("本日の順位", "Today's board")}
              />
              {publishedBattle ? (
                <LeagueRankingBoard
                  members={publishedBattle.members}
                  tier={publishedBattle.tier}
                  promotionCutoff={publishedBattle.promotionCutoff}
                  title={tx("前回の結果", "Last battle")}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </LeagueShell>
  );
}
