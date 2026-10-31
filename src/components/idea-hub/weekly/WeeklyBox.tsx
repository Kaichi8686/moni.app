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

const SLOT_RIM = ["#58CC02", "#1CB0F6", "#FF9600", "#FF4B4B", "#CE82FF", "#FFC800"] as const;

/** Tall wooden milk crate — bottles kapo into holes (neck+cap only visible). */
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
    <div className={`relative ${compact ? "w-[11.5rem]" : "w-full max-w-sm"}`}>
      {label ? (
        <p
          className={`mb-2 text-center font-extrabold tracking-wide text-[#3C3C3C] ${
            compact ? "text-[11px]" : "text-[13px]"
          }`}
        >
          {label}
        </p>
      ) : null}

      {/* Tall crate walls */}
      <div
        className="relative overflow-visible rounded-[1.2rem]"
        style={{
          padding: compact ? "10px 8px 14px" : "14px 12px 20px",
          background: "linear-gradient(180deg, #A8733E 0%, #6B4423 45%, #3E2714 100%)",
          border: "3px solid #2A180C",
          boxShadow: `
            0 18px 0 #1A0E06,
            0 26px 36px rgba(20,10,0,0.35),
            inset 0 3px 0 rgba(255,220,170,0.25),
            inset 0 -12px 20px rgba(0,0,0,0.25)
          `,
        }}
      >
        {/* Vertical slat lines on walls */}
        <div
          className="pointer-events-none absolute inset-x-2 top-2 bottom-3 rounded-[0.9rem] opacity-35"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent 0 22px,
              rgba(30,15,5,0.35) 22px 24px
            )`,
            border: "2px solid rgba(30,15,5,0.25)",
          }}
        />

        {/* Handle slots on front wall */}
        <div className={`relative mb-3 flex justify-center ${compact ? "gap-6" : "gap-10"}`}>
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`block rounded-full ${compact ? "h-2.5 w-10" : "h-3 w-14"}`}
              style={{
                background: "#1A0E06",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6), 0 1px 0 rgba(255,220,170,0.2)",
              }}
            />
          ))}
        </div>

        {/* Inner deck with holes */}
        <div
          className={`relative rounded-[0.85rem] ${compact ? "p-2" : "p-3"}`}
          style={{
            background: "linear-gradient(180deg, #E8C49A 0%, #C9955A 100%)",
            boxShadow: "inset 0 4px 10px rgba(60,30,10,0.35), 0 2px 0 #5A3818",
            border: "2px solid #5A3818",
          }}
        >
          <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
            {([0, 1, 2, 3, 4, 5] as WeekdaySlot[]).map((slot) => {
              const bottle = bySlot.get(slot);
              const rim = SLOT_RIM[slot];
              const isInserting = insertingSlot === slot;
              const isToday = todaySlot === slot;
              const isHighlight = highlightSlot === slot;
              const emptyToday = !bottle && isToday && onEmptyToday;

              return (
                <div key={slot} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    disabled={!bottle && !emptyToday}
                    onClick={() => {
                      if (bottle) onSelectBottle?.(bottle);
                      else if (emptyToday) onEmptyToday();
                    }}
                    aria-label={bottle ? `${labels[slot]}: ${bottle.title}` : labels[slot]}
                    className={`relative ${compact ? "h-14 w-14" : "h-[5.25rem] w-[5.25rem]"} ${
                      bottle || emptyToday ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* Hole pit */}
                    <span
                      className="absolute inset-[8%] rounded-full"
                      style={{
                        background: "radial-gradient(circle at 50% 30%, #4A2E14 0%, #1A0E06 70%)",
                        boxShadow: "inset 0 10px 16px rgba(0,0,0,0.75)",
                        border: `3px solid ${bottle || isToday ? rim : "#5A3818"}`,
                        outline: isHighlight || isInserting ? `3px solid ${rim}` : undefined,
                        outlineOffset: 2,
                      }}
                    />

                    {/* Bottle: cork above the board, short neck into the hole (natural size, not stretched) */}
                    {bottle ? (
                      <span
                        className={`absolute left-1/2 z-[4] flex -translate-x-1/2 justify-center transition-transform duration-500 ${
                          isInserting ? "-translate-y-3 scale-110" : ""
                        }`}
                        style={{ top: compact ? "-28%" : "-24%" }}
                      >
                        <BottleVisual size={compact ? "sm" : "md"} seated />
                      </span>
                    ) : null}

                    {/* Thick board rim (under the visible cork) */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-[3] rounded-full"
                      style={{
                        background: `radial-gradient(circle,
                          transparent 0 22%,
                          #6B4423 23%,
                          #E8C49A 36%,
                          #C9955A 52%,
                          #8B5A2B 66%,
                          transparent 67%)`,
                        boxShadow: "inset 0 2px 0 rgba(255,240,210,0.45)",
                      }}
                    />

                    {emptyToday && !bottle ? (
                      <span className="absolute inset-0 z-[4] flex items-center justify-center text-lg font-black text-[#E8C49A]/9">
                        ?
                      </span>
                    ) : null}
                  </button>
                  <span
                    className={`font-extrabold ${compact ? "text-[10px]" : "text-xs"} ${
                      isToday ? "text-[#FFF3D1]" : "text-[#E8C49A]"
                    }`}
                    style={{ textShadow: "0 1px 0 rgba(20,10,0,0.45)" }}
                  >
                    {labels[slot]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
