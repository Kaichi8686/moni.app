"use client";

import { IdeaCard } from "@/components/projects/idea-voting/IdeaCard";
import type { IdeaWithTally, IdeaVotingSettings } from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  ideas: IdeaWithTally[];
  votingSettings: IdeaVotingSettings;
  votingClosed: boolean;
  sortByVotes: boolean;
  /** 結果バーを出す */
  showResults?: boolean;
  /** 結果バーの上限（候補中の最大票数） */
  resultBarMax?: number;
  /** チェック選択モード */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  votesRemaining: number;
  currentUid: string | null;
  isOwner: boolean;
  /** 投票のみ（選択肢の削除・編集なし） */
  voteOnly?: boolean;
  onToggleSelect?: (id: string) => void;
  onDelete: (id: string) => void;
};

export function IdeaList({
  ideas,
  votingSettings,
  votingClosed,
  sortByVotes,
  showResults = false,
  resultBarMax = 1,
  selectMode = false,
  selectedIds,
  votesRemaining,
  currentUid,
  isOwner,
  voteOnly = false,
  onToggleSelect,
  onDelete,
}: Props) {
  const { tx } = useI18n();
  const display = sortByVotes
    ? [...ideas].sort((a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt))
    : ideas;

  if (display.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 px-3 py-4 text-[12px] text-zinc-500">
        {voteOnly
          ? tx("まだ選択肢がありません。", "No options yet.")
          : tx("まだ選択肢がありません。上から追加してください。", "No options yet. Add one above.")}
      </div>
    );
  }

  const rankById = new Map<string, number>();
  if (votingClosed && showResults) {
    const ranked = [...ideas].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
    ranked.slice(0, 3).forEach((idea, i) => rankById.set(idea.id, i + 1));
  }

  const pendingSelectedCount = selectedIds
    ? [...selectedIds].filter((id) => (ideas.find((i) => i.id === id)?.myVotes ?? 0) <= 0).length
    : 0;

  return (
    <ul className="space-y-1.5">
      {display.map((idea) => {
        const alreadyVoted = idea.myVotes > 0;
        const isSelected = Boolean(selectedIds?.has(idea.id));
        const canToggle =
          !votingClosed &&
          !alreadyVoted &&
          (isSelected ||
            (votesRemaining > pendingSelectedCount && idea.myVotes < votingSettings.maxVotesPerIdea));
        const canDelete =
          !voteOnly && Boolean(currentUid) && (isOwner || idea.authorId === currentUid);
        return (
          <li key={idea.id}>
            <IdeaCard
              idea={idea}
              rank={rankById.get(idea.id)}
              votingClosed={votingClosed}
              showResults={showResults}
              resultBarMax={resultBarMax}
              selectMode={selectMode}
              selected={isSelected || alreadyVoted}
              canSelect={canToggle}
              canDelete={canDelete}
              onToggleSelect={onToggleSelect}
              onDelete={onDelete}
            />
          </li>
        );
      })}
    </ul>
  );
}
