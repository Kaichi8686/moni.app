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
        {tx("まだアイデアが提出されていません", "No idea submitted yet")}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {tx(
          "最初のアイデアを投稿して、AI審査員からの評価と勝ち点をゲットしましょう！",
          "Submit your first idea to earn AI review feedback and match points!",
        )}
      </p>
      <div className="mx-auto mt-5 max-w-xs">
        <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onSubmitIdea}>
          {tx("アイデアを投稿する", "Submit an idea")}
        </DuoButton>
      </div>
    </div>
  );
}
