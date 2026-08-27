"use client";

import { IdeaCard } from "@/components/projects/idea-voting/IdeaCard";
import type { IdeaWithTally, IdeaVotingSettings } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  ideas: IdeaWithTally[];
  votingSettings: IdeaVotingSettings;
  votingClosed: boolean;
  sortByVotes: boolean;
  hideTallies?: boolean;
  votesRemaining: number;
  currentUid: string | null;
  isOwner: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onDelete: (id: string) => void;
};

export function IdeaList({
  ideas,
  votingSettings,
  votingClosed,
  sortByVotes,
  hideTallies = false,
  votesRemaining,
  currentUid,
  isOwner,
  onVote,
  onUnvote,
  onDelete,
}: Props) {
  const { tx } = useI18n();
  const display = sortByVotes
    ? [...ideas].sort((a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt))
    : ideas;

  if (display.length === 0) {
    return (
      <div className="border border-dashed border-zinc-300 px-3 py-4 text-[12px] text-zinc-500">
        {tx("まだ選択肢がありません。上から追加してください。", "No options yet. Add one above.")}
      </div>
    );
  }

  const rankById = new Map<string, number>();
  if (votingClosed && !hideTallies) {
    const ranked = [...ideas].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
    ranked.slice(0, 3).forEach((idea, i) => rankById.set(idea.id, i + 1));
  }

  return (
    <ul className="space-y-1.5">
      {display.map((idea) => {
        const canVote =
          !votingClosed && votesRemaining > 0 && idea.myVotes < votingSettings.maxVotesPerIdea;
        const canUnvote = !votingClosed && idea.myVotes > 0;
        const canDelete = Boolean(currentUid) && (isOwner || idea.authorId === currentUid);
        return (
          <li key={idea.id}>
            <IdeaCard
              idea={idea}
              rank={rankById.get(idea.id)}
              canVote={canVote}
              canUnvote={canUnvote}
              votingClosed={votingClosed}
              hideTallies={hideTallies}
              canDelete={canDelete}
              onVote={onVote}
              onUnvote={onUnvote}
              onDelete={onDelete}
            />
          </li>
        );
      })}
    </ul>
  );
}
