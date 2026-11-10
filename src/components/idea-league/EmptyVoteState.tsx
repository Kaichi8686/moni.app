"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  onSubmitIdea: () => void;
};

export function EmptyVoteState({ onSubmitIdea }: Props) {
  const { tx } = useI18n();

  return (
    <div className="rounded-[28px] bg-white/95 px-5 py-8 text-center shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80 sm:px-8 sm:py-10">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF4E5] to-[#EEF2FF] text-2xl shadow-inner ring-1 ring-zinc-200/70"
        aria-hidden
      >
        💡
      </div>
      <h3 className="mt-4 text-base font-black tracking-tight text-zinc-900 sm:text-lg">
        {tx("まだ誰もアイデアを提出していません", "No ideas submitted yet")}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-zinc-600">
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
