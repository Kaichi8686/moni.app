"use client";

import { IdeaCard } from "@/components/contest/IdeaCard";
import type { ContestGallerySort, ContestIdea } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  ideas: ContestIdea[];
  sort: ContestGallerySort;
  onSortChange: (sort: ContestGallerySort) => void;
  onOpen: (idea: ContestIdea) => void;
  onToggleLike: (idea: ContestIdea) => Promise<void> | void;
  loading?: boolean;
  canLike?: boolean;
};

const TABS: Array<{ id: ContestGallerySort; ja: string; en: string }> = [
  { id: "popular", ja: "人気", en: "Top" },
  { id: "newest", ja: "新着", en: "New" },
  { id: "mine", ja: "自分", en: "Mine" },
];

export function IdeaGallery({
  ideas,
  sort,
  onSortChange,
  onOpen,
  onToggleLike,
  loading,
  canLike = true,
}: Props) {
  const { tx } = useI18n();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-950">
          {tx("ギャラリー", "Gallery")}
        </h2>
        <p className="text-[11px] font-medium tabular-nums text-zinc-400">
          {tx(`${ideas.length}件`, `${ideas.length}`)}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={tx("並び替え", "Sort")}
        className="grid grid-cols-3 rounded-lg border border-zinc-200 bg-white p-0.5"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sort === tab.id}
            onClick={() => onSortChange(tab.id)}
            className={`min-h-9 touch-manipulation rounded-md px-1 text-[12px] font-medium leading-snug transition ${
              sort === tab.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tx(tab.ja, tab.en)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-zinc-700">
            {sort === "mine"
              ? tx("まだ投稿がありません", "No posts yet")
              : tx("最初のアイデアを待っています", "Be the first to share")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <IdeaCard idea={idea} onOpen={onOpen} onToggleLike={onToggleLike} disabledLike={!canLike} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
