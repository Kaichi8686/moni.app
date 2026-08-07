"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  score: number;
  myVote: 0 | 1 | -1;
  disabled?: boolean;
  onVote: (value: 1 | -1) => void;
};

export function QnAVoteControl({ score, myVote, disabled, onVote }: Props) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
      <button
        type="button"
        disabled={disabled}
        aria-label="役に立った"
        aria-pressed={myVote === 1}
        onClick={() => onVote(1)}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
          myVote === 1 ? "bg-zinc-900 text-white" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        }`}
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
      <span
        className={`min-w-[1.25rem] text-center text-[12px] font-semibold tabular-nums ${
          score > 0 ? "text-zinc-900" : score < 0 ? "text-zinc-500" : "text-zinc-400"
        }`}
      >
        {score}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-label="役に立たなかった"
        aria-pressed={myVote === -1}
        onClick={() => onVote(-1)}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40 ${
          myVote === -1 ? "bg-zinc-200 text-zinc-800" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        }`}
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
