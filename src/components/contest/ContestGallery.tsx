"use client";

import { ContestEntryCard } from "@/components/contest/ContestEntryCard";
import type { ContestEntry, ContestGallerySort } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  entries: ContestEntry[];
  sort: ContestGallerySort;
  onSortChange: (sort: ContestGallerySort) => void;
  onToggleLike: (entry: ContestEntry) => Promise<void> | void;
  loading?: boolean;
  canLike?: boolean;
};

const TABS: Array<{ id: ContestGallerySort; ja: string; en: string }> = [
  { id: "popular", ja: "人気順", en: "Popular" },
  { id: "newest", ja: "新着順", en: "Newest" },
  { id: "mine", ja: "自分の応募", en: "My entries" },
];

export function ContestGallery({
  entries,
  sort,
  onSortChange,
  onToggleLike,
  loading,
  canLike = true,
}: Props) {
  const { tx } = useI18n();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">{tx("応募ギャラリー", "Entry gallery")}</h2>
        <p className="text-[11px] font-medium tabular-nums text-zinc-400">
          {tx(`${entries.length}件`, `${entries.length}`)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSortChange(tab.id)}
            className={`min-h-10 touch-manipulation rounded-lg px-1 text-[12px] font-semibold leading-snug transition ${
              sort === tab.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tx(tab.ja, tab.en)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-zinc-700">
            {sort === "mine"
              ? tx("まだ応募がありません", "No entries yet")
              : tx("最初のロードマップを待っています", "Be the first to enter")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {tx("上のボタンから気軽に応募できます", "Apply from the button above")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ContestEntryCard entry={entry} onToggleLike={onToggleLike} disabledLike={!canLike} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
