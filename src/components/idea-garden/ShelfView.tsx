"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { FlowerArt } from "@/components/idea-garden/illustrations/FlowerArt";
import { formatWeekLabel, weekdayLabel } from "@/lib/idea-garden/calendar";
import type { PlantedIdea } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  weekKeys: string[];
  weekIndex: number;
  onWeekIndex: (i: number) => void;
  plants: PlantedIdea[];
  headerSlot?: ReactNode;
};

export function ShelfView({ weekKeys, weekIndex, onWeekIndex, plants, headerSlot }: Props) {
  const { tx, locale } = useI18n();
  const weekKey = weekKeys[weekIndex] ?? weekKeys[0]!;
  const touchX = useRef<number | null>(null);

  const goPrev = () => {
    if (weekIndex < weekKeys.length - 1) onWeekIndex(weekIndex + 1);
  };
  const goNext = () => {
    if (weekIndex > 0) onWeekIndex(weekIndex - 1);
  };

  // Arrange up to 6 plants on 3 shelves (2 per row), gold ones preferred mid
  const sorted = [...plants].sort(
    (a, b) => Number(b.gold) - Number(a.gold) || a.dateKey.localeCompare(b.dateKey),
  );
  const rows: PlantedIdea[][] = [[], [], []];
  sorted.forEach((p, i) => {
    rows[Math.min(2, Math.floor(i / 2))]!.push(p);
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-4 pt-2">
      {headerSlot}

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={weekIndex >= weekKeys.length - 1}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-sm disabled:opacity-30"
          aria-label={tx("先週", "Previous week")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-[14px] font-extrabold text-[#3C3C3C]">
          {formatWeekLabel(weekKey, locale === "en" ? "en" : "ja")}
        </p>
        <button
          type="button"
          onClick={goNext}
          disabled={weekIndex <= 0}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-sm disabled:opacity-30"
          aria-label={tx("今週へ", "Newer week")}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative mt-4 overflow-hidden rounded-[1.75rem] border-[3px] border-[#C4A484] bg-gradient-to-b from-[#8FD3F4] via-[#B8E994] to-[#8B5A2B]"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          if (start == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? start) - start;
          if (dx > 56) goPrev();
          else if (dx < -56) goNext();
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] shadow-[inset_0_0_0_10px_#A67C52]" />

        <div className="relative space-y-1 px-3 pb-5 pt-6">
          {rows.map((row, ri) => (
            <div key={ri} className="relative">
              <div className="flex min-h-[132px] items-end justify-around px-2 pb-2">
                {row.length === 0 ? (
                  <p className="mb-8 text-[12px] font-bold text-white/70">
                    {ri === 0 && plants.length === 0 ? tx("まだ花がないよ", "No flowers yet") : ""}
                  </p>
                ) : (
                  row.map((plant) => (
                    <motion.div
                      key={plant.id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="relative flex w-[42%] flex-col items-center"
                    >
                      {plant.gold ? (
                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                            <path
                              d="M8 0 L9.5 6 L16 8 L9.5 10 L8 16 L6.5 10 L0 8 L6.5 6 Z"
                              fill="#FEF08A"
                              stroke="#F59E0B"
                              strokeWidth="0.8"
                            />
                          </svg>
                          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                            <path
                              d="M8 0 L9.5 6 L16 8 L9.5 10 L8 16 L6.5 10 L0 8 L6.5 6 Z"
                              fill="#FDE68A"
                              stroke="#D97706"
                              strokeWidth="0.8"
                            />
                          </svg>
                        </div>
                      ) : null}
                      <FlowerArt
                        kind={plant.flowerKind}
                        gold={plant.gold}
                        stage={4}
                        className="h-[120px] w-[100px] drop-shadow-md"
                      />
                      <p className="mt-0.5 max-w-full truncate text-center text-[11px] font-extrabold text-[#3C3C3C]">
                        {plant.title}
                      </p>
                      <p className="text-[10px] font-bold text-[#5B4636]">
                        {weekdayLabel(plant.weekday, locale === "en" ? "en" : "ja")}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
              <div className="relative mx-1 h-3 rounded-md bg-[#A67C52] shadow-[0_4px_0_#7A5230]">
                <div className="absolute inset-x-2 top-0.5 h-1 rounded-full bg-[#C4A484]/opacity-70" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] font-semibold text-zinc-500">
        {tx("左右にスライドして過去の週を見る", "Swipe sideways for past weeks")}
      </p>
    </div>
  );
}
