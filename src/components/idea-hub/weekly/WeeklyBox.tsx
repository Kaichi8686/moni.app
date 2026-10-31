"use client";

import { BottleVisual } from "@/components/idea-hub/weekly/BottleVisual";
import {
  WEEKDAY_LABELS_EN,
  WEEKDAY_LABELS_JA,
  type BottledIdea,
  type WeekdaySlot,
} from "@/lib/idea-hub/weeklyBottles";

type Props = {
  bottles: BottledIdea[];
  locale: "ja" | "en";
  highlightSlot?: WeekdaySlot | null;
  insertingSlot?: WeekdaySlot | null;
  todaySlot?: WeekdaySlot | null;
  onSelectBottle?: (bottle: BottledIdea) => void;
  onEmptyToday?: () => void;
  compact?: boolean;
  label?: string;
};

const SLOT_COLORS = [
  { face: "#58CC02", base: "#46A302" },
  { face: "#1CB0F6", base: "#1899D6" },
  { face: "#FF9600", base: "#E08600" },
  { face: "#FF4B4B", base: "#EA2B2B" },
  { face: "#CE82FF", base: "#A568CC" },
  { face: "#FFC800", base: "#E5A500" },
] as const;

export function WeeklyBox({
  bottles,
  locale,
  highlightSlot = null,
  insertingSlot = null,
  todaySlot = null,
  onSelectBottle,
  onEmptyToday,
  compact = false,
  label,
}: Props) {
  const bySlot = new Map(bottles.map((b) => [b.slot, b]));
  const labels = locale === "en" ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS_JA;

  return (
    <div className={`relative ${compact ? "w-[10rem]" : "w-full max-w-sm"}`}>
      {label ? (
        <p
          className={`mb-2 text-center text-[13px] font-extrabold tracking-wide text-[#3C3C3C] ${
            compact ? "text-[11px]" : ""
          }`}
        >
          {label}
        </p>
      ) : null}

      <div
        className={`relative overflow-hidden rounded-[24px] border-[3px] border-[#E5E5E5] bg-white ${
          compact ? "px-2.5 pb-3 pt-3" : "px-4 pb-5 pt-5"
        }`}
        style={{ boxShadow: "0 6px 0 #E5E5E5" }}
      >
        {/* soft sky wash */}
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(28,176,246,0.12), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(88,204,2,0.08), transparent 50%)",
          }}
        />

        <div className={`relative grid grid-cols-3 ${compact ? "gap-2" : "gap-3.5"}`}>
          {([0, 1, 2, 3, 4, 5] as WeekdaySlot[]).map((slot) => {
            const bottle = bySlot.get(slot);
            const colors = SLOT_COLORS[slot];
            const isInserting = insertingSlot === slot;
            const isToday = todaySlot === slot;
            const isHighlight = highlightSlot === slot;
            const emptyToday = !bottle && isToday && onEmptyToday;

            return (
              <div key={slot} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!bottle && !emptyToday}
                  onClick={() => {
                    if (bottle) onSelectBottle?.(bottle);
                    else if (emptyToday) onEmptyToday();
                  }}
                  className={`group relative ${compact ? "h-12 w-12" : "h-[4.5rem] w-[4.5rem]"} ${
                    bottle || emptyToday ? "cursor-pointer" : "cursor-default"
                  }`}
                  aria-label={bottle ? `${labels[slot]}: ${bottle.title}` : labels[slot]}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 top-[5px] rounded-full"
                    style={{ background: bottle ? colors.base : "#AFAFAF" }}
                  />
                  <span
                    className={`absolute inset-x-0 bottom-[5px] top-0 flex items-end justify-center overflow-hidden rounded-full border-[3px] border-black/5 transition-transform duration-100 group-active:translate-y-[4px] ${
                      isHighlight || isInserting ? "ring-4 ring-[#FFC800]/80" : ""
                    } ${isToday && !bottle ? "ring-4 ring-[#58CC02]/45" : ""}`}
                    style={{ background: bottle ? colors.face : "#E5E5E5" }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[12%] rounded-full"
                      style={{
                        background: `radial-gradient(circle at 50% 28%, ${
                          bottle ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)"
                        } 0%, transparent 62%)`,
                      }}
                    />
                    {bottle ? (
                      <span
                        className={`relative z-[1] mb-[10%] transition-transform duration-500 ${
                          isInserting ? "scale-125 -translate-y-2" : ""
                        }`}
                      >
                        <BottleVisual size={compact ? "xs" : "sm"} />
                      </span>
                    ) : emptyToday ? (
                      <span className="relative z-[1] mb-2 text-lg font-black text-[#AFAFAF]">?</span>
                    ) : null}
                  </span>
                </button>
                <span
                  className={`font-extrabold text-[#777] ${compact ? "text-[10px]" : "text-xs"} ${
                    isToday ? "text-[#58CC02]" : ""
                  }`}
                >
                  {labels[slot]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
