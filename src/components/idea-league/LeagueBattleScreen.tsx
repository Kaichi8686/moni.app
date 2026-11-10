"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { EmptyVoteState } from "@/components/idea-league/EmptyVoteState";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueStatusCard } from "@/components/idea-league/LeagueStatusCard";
import { scheduleFor, voteWindow } from "@/lib/idea-league/calendar";
import type { LeagueBattleState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  battle: LeagueBattleState;
  publishedBattle?: LeagueBattleState | null;
  onSubmit: (input: { title: string; content: string; appeal?: string }) => Promise<void>;
  onVote: (submissionId: string) => Promise<void>;
  countdownActive?: boolean;
};

export function LeagueBattleScreen({
  battle,
  publishedBattle,
  onSubmit,
  onVote,
  countdownActive = true,
}: Props) {
  const { locale, tx } = useI18n();
  const phase = battle.phase;
  const defaultTab = phase === "vote" ? "vote" : phase === "results" ? "board" : "prompt";
  const [tab, setTab] = useState<"board" | "prompt" | "vote">(defaultTab);
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

  async function handleVote(id: string) {
    setBusy(true);
    setErr("");
    try {
      await onVote(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const phaseLabel =
    phase === "submit"
      ? tx("提出タイム（他の解答は非公開）", "Submit window (peers hidden)")
      : phase === "vote"
        ? tx("投票タイム", "Voting window")
        : tx("結果公表", "Results published");

  const countdownLabel =
    phase === "submit"
      ? tx("提出締切まで", "Until submit closes")
      : tx("結果公表まで", "Until results");

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-3 sm:space-y-5">
      <LeagueStatusCard
        tier={battle.tier}
        phaseLabel={phaseLabel}
        countdownTarget={phase === "submit" || phase === "vote" ? endsAt : null}
        countdownLabel={countdownLabel}
        members={battle.members}
        promotionCutoff={battle.promotionCutoff}
        countdownActive={countdownActive}
      />

      <div className="rounded-[28px] bg-white p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
          {tx("今週の共通お題", "This week's shared prompt")}
        </p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{battle.week.promptTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{battle.week.promptBody}</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/90 p-1 shadow-[0_4px_0_rgba(24,24,27,0.04)] ring-1 ring-zinc-200/70">
        {(
          [
            ["prompt", phase === "submit" ? tx("提出", "Submit") : tx("お題", "Prompt")],
            ["vote", tx("投票", "Vote")],
            ["board", tx("結果", "Results")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-10 rounded-xl text-xs font-extrabold transition sm:text-sm ${
              tab === id ? "bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]" : "text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

      {tab === "prompt" ? (
        phase === "submit" ? (
          <div className="space-y-3 rounded-[28px] bg-white/95 p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80 sm:p-5">
            <p className="text-sm font-medium text-zinc-600">
              {tx(
                "日曜朝11時まで提出できます。締切までは他の人の解答は見えません。",
                "Submit until Sunday 11:00. Peer answers stay hidden until then.",
              )}
            </p>
            <label className="block">
              <span className="text-xs font-bold text-zinc-600">{tx("タイトル", "Title")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF9600]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-600">{tx("アイデア", "Idea")}</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF9600]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-600">
                {tx("ひとことアピール（任意）", "Short pitch (optional)")}
              </span>
              <input
                value={appeal}
                onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF9600]"
              />
            </label>
            <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={() => void handleSubmit()}>
              {battle.mySubmission
                ? tx("アイデアを更新する", "Update idea")
                : tx("アイデアを提出する", "Submit idea")}
            </DuoButton>
          </div>
        ) : (
          <p className="rounded-[28px] bg-white/90 px-4 py-8 text-center text-sm font-semibold text-zinc-500 ring-1 ring-zinc-200/70">
            {tx("提出期間は終了しました。投票タブへどうぞ。", "Submit window closed — head to Vote.")}
          </p>
        )
      ) : null}

      {tab === "vote" ? (
        phase === "submit" ? (
          <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white/90 px-4 py-10 text-center text-sm font-semibold text-zinc-500">
            {tx(
              "投票は日曜朝11時から始まります。それまで他の解答は非公開です。",
              "Voting starts Sunday 11:00. Peer answers stay private until then.",
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-600">
              {tx(
                "自分以外のアイデアに1票。水曜11時に結果が公開されます。",
                "One vote for someone else. Results publish Wednesday 11:00.",
              )}
            </p>
            {battle.submissions.filter((s) => !s.isMe).length === 0 ? (
              <EmptyVoteState onSubmitIdea={() => setTab("prompt")} />
            ) : (
              battle.submissions
                .filter((s) => !s.isMe)
                .map((s) => (
                  <article
                    key={s.id}
                    className={`rounded-[28px] bg-white p-4 shadow-[0_6px_0_rgba(24,24,27,0.05)] ring-1 sm:p-5 ${
                      s.votedByMe ? "ring-[#FF9600]" : "ring-zinc-200/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-zinc-500">{s.authorName}</p>
                        <h3 className="text-base font-black text-zinc-900">{s.title}</h3>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-black tabular-nums text-zinc-700">
                        {s.voteCount}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.content}</p>
                    {s.appeal ? (
                      <p className="mt-2 text-xs font-semibold text-indigo-700">
                        {locale === "en" ? "Pitch: " : "アピール: "}
                        {s.appeal}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <DuoButton
                        type="button"
                        tone={s.votedByMe ? "peach" : "orange"}
                        size="md"
                        fullWidth
                        disabled={busy || phase !== "vote"}
                        onClick={() => void handleVote(s.id)}
                      >
                        {s.votedByMe
                          ? tx("投票済み", "Voted")
                          : tx("このアイデアに投票", "Vote for this idea")}
                      </DuoButton>
                    </div>
                  </article>
                ))
            )}
          </div>
        )
      ) : null}

      {tab === "board" ? (
        phase === "results" ? (
          <LeagueRankingBoard members={battle.members} tier={battle.tier} promotionCutoff={battle.promotionCutoff} />
        ) : publishedBattle ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-500">
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
          <div className="rounded-[28px] border border-dashed border-zinc-200 bg-white/90 px-4 py-10 text-center text-sm font-semibold text-zinc-500">
            {tx(
              "結果は水曜朝11時に公開されます。それまでは先週の結果を表示します。",
              "Results publish Wednesday 11:00. Until then, last week’s board is shown.",
            )}
          </div>
        )
      ) : null}

      {battle.members.length <= 1 ? (
        <p className="text-center text-[11px] font-medium text-zinc-400">
          {tx(
            "同じリーグに参加している登録ユーザーの順位が表示されます。",
            "Ranks show registered users in your league group.",
          )}
        </p>
      ) : null}
    </div>
  );
}
