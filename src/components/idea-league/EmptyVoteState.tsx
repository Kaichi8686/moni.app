"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onSubmitIdea: () => void;
};

export function EmptyVoteState({ onSubmitIdea }: Props) {
  const { tx } = useI18n();

  return (
    <div className={`${leagueCardClass} px-5 py-8 text-center sm:px-8 sm:py-10`}>
      <h3 className="text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
        {tx("まだ誰もアイデアを提出していません", "No ideas submitted yet")}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {tx(
          "あなたが最初のアイデアを出してみませんか？",
          "Want to be the first to submit an idea?",
        )}
      </p>
      <div className="mx-auto mt-5 max-w-xs">
        <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onSubmitIdea}>
          {tx("✍️ アイデアを投稿する", "✍️ Submit an idea")}
        </DuoButton>
      </div>
    </div>
  );
}
