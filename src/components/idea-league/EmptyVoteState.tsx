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
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xl"
        aria-hidden
      >
        💡
      </div>
      <h3 className="mt-4 text-base font-bold tracking-tight text-zinc-900 sm:text-lg">
        {tx("まだ誰もアイデアを提出していません", "No ideas submitted yet")}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {tx(
          "あなたが最初のアイデアを出してみませんか？一投目がリーグを動かします。",
          "Want to post the first idea? Your submission gets the league moving.",
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
