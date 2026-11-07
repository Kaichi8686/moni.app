"use client";

import { Check, Trash2, Trophy } from "lucide-react";
import type { IdeaWithTally } from "@/lib/projects/ideaVoting/types";
import { voteCard, voteChip } from "@/components/projects/idea-voting/voteUi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  idea: IdeaWithTally;
  rank?: number;
  votingClosed: boolean;
  /** 結果バー・票数を出す */
  showResults?: boolean;
  /** 結果バーの上限（候補中の最大票数） */
  resultBarMax?: number;
  /** チェックで選ぶモード（投票ボタンはフッター側） */
  selectMode?: boolean;
  selected?: boolean;
  canSelect?: boolean;
  canDelete: boolean;
  onToggleSelect?: (id: string) => void;
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
  votingClosed,
  showResults = false,
  resultBarMax = 1,
  selectMode = false,
  selected = false,
  canSelect = false,
  canDelete,
  onToggleSelect,
  onDelete,
}: Props) {
  const { tx, locale } = useI18n();
  const isTop = Boolean(rank && rank <= 3 && votingClosed && showResults);
  const voted = idea.myVotes > 0;
  const checked = selected || voted;
  const max = Math.max(1, resultBarMax);
  const barPct = showResults ? Math.min(100, Math.round((idea.votes / max) * 100)) : 0;
  const selectable = selectMode && !votingClosed && (canSelect || voted);

  return (
    <article
      className={`${voteCard} rounded-2xl ${isTop && rank === 1 ? "border-zinc-900" : ""} ${
        checked && !votingClosed ? "border-[#FF9600]/40 bg-orange-50/40" : ""
      } px-3 py-2.5`}
    >
      <button
        type="button"
        disabled={!selectable}
        onClick={() => {
          if (!selectable || !onToggleSelect) return;
          onToggleSelect(idea.id);
        }}
        className="flex w-full items-start gap-3 text-left disabled:cursor-default"
        aria-pressed={checked}
        aria-label={tx("候補を選ぶ", "Select option")}
      >
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
            {showResults && idea.voters > 0 ? (
              <span> · {tx(`${idea.voters}人`, `${idea.voters} people`)}</span>
            ) : null}
            {idea.myVotes > 0 ? (
              <span className="text-zinc-700"> · {tx(`あなた ${idea.myVotes}`, `you ${idea.myVotes}`)}</span>
            ) : null}
          </p>

          {showResults ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-[#FF9600] transition-[width] duration-300"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-zinc-900">
                {idea.votes}
                <span className="ml-0.5 text-[10px] font-medium text-zinc-400">{tx("票", "votes")}</span>
              </span>
            </div>
          ) : null}
        </div>

        {selectMode && !votingClosed ? (
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
              checked
                ? "border-[#FF9600] bg-[#FF9600] text-white"
                : canSelect
                  ? "border-zinc-300 bg-white text-transparent"
                  : "border-zinc-200 bg-zinc-50 text-transparent"
            }`}
            aria-hidden
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        ) : null}
      </button>

      {canDelete ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(idea.id)}
            className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-rose-600"
            aria-label={tx("この選択肢を削除", "Delete this option")}
          >
            <Trash2 className="h-3 w-3" />
            {tx("削除", "Delete")}
          </button>
        </div>
      ) : null}
    </article>
  );
}
