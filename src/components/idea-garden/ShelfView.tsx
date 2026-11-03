"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { FlowerArt } from "@/components/idea-garden/illustrations/FlowerArt";
import { formatWeekLabel, weekdayLabel } from "@/lib/idea-garden/calendar";
import type { PlantedIdea } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const COLS = 3;
/** 見た目用の最低棚段数（スクロールでいくらでも増える） */
const MIN_ROWS = 2;

type Props = {
  weekKeys: string[];
  weekIndex: number;
  onWeekIndex: (i: number) => void;
  plants: PlantedIdea[];
  headerSlot?: ReactNode;
  onPlantClick?: (plant: PlantedIdea) => void;
  /** 丸囲みプラス → 新しい種袋選びへ */
  onAddClick?: () => void;
};

export function ShelfView({
  weekKeys,
  weekIndex,
  onWeekIndex,
  plants,
  headerSlot,
  onPlantClick,
  onAddClick,
}: Props) {
  const { tx, locale } = useI18n();
  const weekKey = weekKeys[weekIndex] ?? weekKeys[0]!;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goPrev = () => {
    if (weekIndex < weekKeys.length - 1) onWeekIndex(weekIndex + 1);
  };
  const goNext = () => {
    if (weekIndex > 0) onWeekIndex(weekIndex - 1);
  };

  // 全花 + プラス。段あたり3つ。足りなければ空段を足し、多い分は縦スクロール。
  const sorted = [...plants].sort(
    (a, b) => Number(b.gold) - Number(a.gold) || a.dateKey.localeCompare(b.dateKey),
  );
  type Slot = { type: "plant"; plant: PlantedIdea } | { type: "add" };
  const items: Slot[] = sorted.map((plant) => ({ type: "plant" as const, plant }));
  if (onAddClick) items.push({ type: "add" });

  const rowCount = Math.max(MIN_ROWS, Math.ceil(Math.max(items.length, 1) / COLS));
  const rows: Slot[][] = Array.from({ length: rowCount }, (_, ri) =>
    items.slice(ri * COLS, ri * COLS + COLS),
  );

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
          const t = e.touches[0];
          touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start == null) return;
          const end = e.changedTouches[0];
          if (!end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          // 縦スクロールと区別：横が大きく動いたときだけ週送り
          if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          if (dx > 0) goPrev();
          else goNext();
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-[1] rounded-[1.6rem] shadow-[inset_0_0_0_10px_#A67C52]" />

        <div className="relative max-h-[min(58vh,480px)] overflow-y-auto overscroll-y-contain px-2 pb-5 pt-6 [-webkit-overflow-scrolling:touch]">
          <div className="relative space-y-1">
            {rows.map((row, ri) => (
              <div key={ri} className="relative">
                <div className="grid min-h-[118px] grid-cols-3 items-end gap-1 px-1 pb-2">
                  {row.length === 0 ? (
                    <p className="col-span-3 mb-8 text-center text-[12px] font-bold text-white/70">
                      {ri === 0 && plants.length === 0 && !onAddClick
                        ? tx("まだ花がないよ", "No flowers yet")
                        : ""}
                    </p>
                  ) : (
                    row.map((slot) =>
                      slot.type === "add" ? (
                        <motion.button
                          key="add-slot"
                          type="button"
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={onAddClick}
                          className="relative mb-5 flex w-full flex-col items-center outline-none [&:active_.plus-face]:translate-y-[4px] [&:active_.plus-face]:shadow-none"
                          aria-label={tx("アイデアを追加", "Add an idea")}
                        >
                          {/* DuoButton と同じ：下帯シャドウ + 押すと沈んで影が消える */}
                          <span
                            className={[
                              "plus-face inline-flex h-[64px] w-[64px] items-center justify-center rounded-full",
                              "border-[4px] border-[#FF9600] bg-white text-[#FF9600]",
                              "shadow-[0_4px_0_#D97706]",
                              "transition-[transform,box-shadow] duration-75 ease-out",
                            ].join(" ")}
                          >
                            <Plus className="h-8 w-8" strokeWidth={3} />
                          </span>
                          <p className="mt-2 text-center text-[11px] font-extrabold text-[#3C3C3C]">
                            {tx("追加", "Add")}
                          </p>
                        </motion.button>
                      ) : (
                        <motion.button
                          key={slot.plant.id}
                          type="button"
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => onPlantClick?.(slot.plant)}
                          className="relative flex w-full flex-col items-center outline-none"
                          aria-label={slot.plant.title}
                        >
                          {slot.plant.gold ? (
                            <div className="pointer-events-none absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                                <path
                                  d="M8 0 L9.5 6 L16 8 L9.5 10 L8 16 L6.5 10 L0 8 L6.5 6 Z"
                                  fill="#FEF08A"
                                  stroke="#F59E0B"
                                  strokeWidth="0.8"
                                />
                              </svg>
                              <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden>
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
                            kind={slot.plant.flowerKind}
                            gold={slot.plant.gold}
                            stage={4}
                            className="h-[100px] w-[84px] drop-shadow-md"
                          />
                          <p className="mt-0.5 max-w-full truncate px-0.5 text-center text-[10px] font-extrabold text-[#3C3C3C]">
                            {slot.plant.title}
                          </p>
                          <p className="text-[9px] font-bold text-[#5B4636]">
                            {weekdayLabel(slot.plant.weekday, locale === "en" ? "en" : "ja")}
                          </p>
                        </motion.button>
                      ),
                    )
                  )}
                </div>
                <div className="relative mx-1 h-3 rounded-md bg-[#A67C52] shadow-[0_4px_0_#7A5230]">
                  <div className="absolute inset-x-2 top-0.5 h-1 rounded-full bg-[#C4A484]/opacity-70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[12px] font-semibold text-zinc-500">
        {tx(
          "左右で週を切替・下にスクロールで棚を伸ばす",
          "Swipe sideways for weeks · scroll down for more shelves",
        )}
      </p>
    </div>
  );
}
