"use client";

import {
  REACTION_META,
  type PostReactionCounts,
  type ReactionKind,
} from "@/lib/feed/postReactions";

type Props = {
  counts: PostReactionCounts;
  myReaction: ReactionKind | null;
  disabled?: boolean;
  onToggle: (kind: ReactionKind) => void;
};

export function PostFeedReactions({ counts, myReaction, disabled, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(REACTION_META) as ReactionKind[]).map((kind) => {
        const meta = REACTION_META[kind];
        const active = myReaction === kind;
        const n = counts[kind];
        return (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            title={meta.label}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              active
                ? "border-violet-400 bg-violet-50 text-violet-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            } disabled:opacity-50`}
            onClick={() => onToggle(kind)}
          >
            <span>{meta.emoji}</span>
            {n > 0 ? <span>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
