"use client";

import { Minus, Trash2, Trophy } from "lucide-react";
import type { IdeaWithTally } from "@/lib/projects/ideaVoting/types";
import { voteBtn, voteBtnGhost, voteBtnPrimary, voteCard, voteChip } from "@/components/projects/idea-voting/voteUi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  idea: IdeaWithTally;
  rank?: number;
  canVote: boolean;
  canUnvote: boolean;
  votingClosed: boolean;
  hideTallies?: boolean;
  canDelete: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatPostedAt(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IdeaCard({
  idea,
  rank,
  canVote,
  canUnvote,
  votingClosed,
  hideTallies = false,
  canDelete,
  onVote,
  onUnvote,
  onDelete,
}: Props) {
  const { tx, locale } = useI18n();
  const isTop = Boolean(rank && rank <= 3 && votingClosed);
  const voted = idea.myVotes > 0;
  const voteLabel = votingClosed
    ? tx("終了", "Closed")
    : canVote
      ? voted
        ? tx("追加", "Add")
        : tx("投票", "Vote")
      : voted
        ? tx("投票済", "Voted")
        : tx("上限", "Max");

  return (
    <article className={`${voteCard} ${isTop && rank === 1 ? "border-zinc-900" : ""} px-3 py-2.5`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {isTop ? (
            <p className={`${voteChip} mb-1.5 border-zinc-900 text-zinc-900`}>
              <Trophy className="h-3 w-3" aria-hidden />
              {tx(`${rank}位`, `#${rank}`)}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-[13px] leading-snug tracking-tight text-zinc-900">{idea.text}</p>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {idea.authorName ?? tx("匿名", "Anonymous")}
            <span> · {formatPostedAt(idea.createdAt, locale)}</span>
            {!hideTallies && idea.voters > 0 ? (
              <span> · {tx(`${idea.voters}人`, `${idea.voters} people`)}</span>
            ) : null}
            {idea.myVotes > 0 ? (
              <span className="text-zinc-700"> · {tx(`あなた ${idea.myVotes}`, `you ${idea.myVotes}`)}</span>
            ) : null}
          </p>
        </div>
        <div className="flex w-[4.75rem] shrink-0 flex-col items-end gap-1">
          <p className="text-right">
            <span className={`text-[15px] font-semibold tabular-nums tracking-tight ${hideTallies ? "text-zinc-300" : "text-zinc-900"}`}>
              {hideTallies ? "—" : idea.votes}
            </span>
            <span className="ml-0.5 text-[10px] text-zinc-400">{hideTallies ? tx("締切後", "After close") : tx("票", "votes")}</span>
          </p>
          <button
            type="button"
            disabled={votingClosed || !canVote}
            onClick={() => onVote(idea.id)}
            className={`w-full ${votingClosed || !canVote ? `${voteBtn} border border-zinc-200 bg-zinc-50 text-zinc-400` : voteBtnPrimary}`}
            aria-label={voted ? tx("さらに投票する", "Vote again") : tx("投票する", "Vote")}
          >
            {voteLabel}
          </button>
          {canUnvote ? (
            <button type="button" onClick={() => onUnvote(idea.id)} className={`${voteBtnGhost} h-7 w-full text-[11px] text-zinc-500`}>
              <Minus className="h-3 w-3" aria-hidden />
              {tx("取消", "Undo")}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={() => onDelete(idea.id)}
              className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-rose-600"
              aria-label={tx("この選択肢を削除", "Delete this option")}
            >
              <Trash2 className="h-3 w-3" />
              {tx("削除", "Delete")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
