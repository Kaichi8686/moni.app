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

/** Blue milk-bottle crate — bottles snap into round wells (top half only). */
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
    <div className={`relative ${compact ? "w-[10.75rem]" : "w-full max-w-sm"}`}>
      {label ? (
        <p
          className={`mb-2 text-center font-extrabold tracking-wide text-[#3C3C3C] ${
            compact ? "text-[11px]" : "text-[13px]"
          }`}
        >
          {label}
        </p>
      ) : null}

      <div className="relative" style={{ paddingBottom: compact ? 10 : 16 }}>
        <div
          className="absolute inset-x-[3%] bottom-0 rounded-[1.35rem]"
          style={{
            height: "93%",
            background: "linear-gradient(180deg, #0B6FA8 0%, #064A72 100%)",
            boxShadow: "0 12px 0 #03314D, 0 20px 28px rgba(10,40,60,0.28)",
          }}
        />
        <div
          className="absolute bottom-[8%] right-[1%] top-[6%] w-[8%] rounded-r-[1rem]"
          style={{
            background: "linear-gradient(90deg, #0A5F90, #03314D)",
            transform: "skewY(-5deg)",
          }}
        />

        <div
          className={`relative rounded-[1.2rem] ${compact ? "px-2 pb-2 pt-3" : "px-3 pb-3.5 pt-4"}`}
          style={{
            background: "linear-gradient(165deg, #2BB0F0 0%, #1A8FC8 45%, #0E6FA5 100%)",
            border: "3.5px solid #0A5A88",
            boxShadow: `
              inset 0 4px 0 rgba(255,255,255,0.35),
              inset 0 -14px 22px rgba(5,40,70,0.28),
              inset 8px 0 14px rgba(255,255,255,0.12),
              inset -8px 0 14px rgba(5,40,70,0.2)
            `,
          }}
        >
          <div className="mb-2 flex justify-center gap-8">
            <span
              className={`rounded-full bg-[#064A72]/55 ${compact ? "h-1.5 w-8" : "h-2 w-12"}`}
              style={{ boxShadow: "inset 0 2px 3px rgba(0,0,0,0.35)" }}
            />
            <span
              className={`rounded-full bg-[#064A72]/55 ${compact ? "h-1.5 w-8" : "h-2 w-12"}`}
              style={{ boxShadow: "inset 0 2px 3px rgba(0,0,0,0.35)" }}
            />
          </div>

          <div
            className={`relative grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}
            style={{
              background: "linear-gradient(180deg, #0A5A88 0%, #064A72 100%)",
              borderRadius: compact ? 12 : 14,
              padding: compact ? 8 : 12,
              boxShadow: "inset 0 6px 14px rgba(0,20,40,0.55)",
              border: "2.5px solid #03314D",
            }}
          >
            {([0, 1, 2, 3, 4, 5] as WeekdaySlot[]).map((slot) => {
              const bottle = bySlot.get(slot);
              const rim = SLOT_RIM[slot];
              const isInserting = insertingSlot === slot;
              const isToday = todaySlot === slot;
              const isHighlight = highlightSlot === slot;
              const emptyToday = !bottle && isToday && onEmptyToday;

              return (
                <div key={slot} className="relative z-[1] flex flex-col items-center gap-1">
                  <button
                    type="button"
                    disabled={!bottle && !emptyToday}
                    onClick={() => {
                      if (bottle) onSelectBottle?.(bottle);
                      else if (emptyToday) onEmptyToday();
                    }}
                    className={`group relative ${compact ? "h-12 w-12" : "h-[4.75rem] w-[4.75rem]"} ${
                      bottle || emptyToday ? "cursor-pointer" : "cursor-default"
                    }`}
                    aria-label={bottle ? `${labels[slot]}: ${bottle.title}` : labels[slot]}
                  >
                    {/* Round milk-crate well */}
                    <span
                      aria-hidden
                      className="absolute inset-[6%] rounded-full"
                      style={{
                        background: "radial-gradient(circle at 50% 30%, #0E6FA5 0%, #03314D 70%)",
                        boxShadow: `
                          inset 0 8px 14px rgba(0,0,0,0.55),
                          inset 0 -3px 0 rgba(125,211,247,0.12),
                          0 2px 0 rgba(125,211,247,0.22)
                        `,
                        border: bottle || isToday ? `3px solid ${rim}` : "2.5px solid #022538",
                        outline: isHighlight || isInserting ? `3px solid ${rim}` : undefined,
                        outlineOffset: 2,
                      }}
                    />

                    {/* Inner hole lip — bottle clips below this rim */}
                    <span
                      aria-hidden
                      className="absolute inset-[18%] overflow-hidden rounded-full"
                      style={{
                        background: "radial-gradient(circle at 50% 20%, #022538 0%, #011828 100%)",
                        boxShadow: "inset 0 4px 8px rgba(0,0,0,0.6)",
                      }}
                    >
                      {bottle ? (
                        <span
                          className={`absolute inset-x-0 flex justify-center transition-transform duration-500 ${
                            isInserting ? "-translate-y-1 scale-110" : ""
                          }`}
                          style={{
                            // Sit in the hole: only neck/shoulder poke above the lip
                            top: compact ? "-28%" : "-22%",
                            height: "140%",
                          }}
                        >
                          <BottleVisual size={compact ? "xs" : "sm"} seated />
                        </span>
                      ) : null}
                    </span>

                    {/* Surface ring on top of the well (covers lower bottle = “kapo”) */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-[6%] rounded-full"
                      style={{
                        boxShadow: `
                          inset 0 0 0 7px rgba(10,90,136,0.92),
                          inset 0 2px 0 rgba(125,211,247,0.25)
                        `,
                      }}
                    />

                    {emptyToday && !bottle ? (
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-[#7DD3F7]/70">
                        ?
                      </span>
                    ) : null}
                  </button>
                  <span
                    className={`font-extrabold ${compact ? "text-[10px]" : "text-xs"} ${
                      isToday ? "text-white" : "text-[#B8E6FA]"
                    }`}
                    style={{ textShadow: "0 1px 0 rgba(3,40,70,0.45)" }}
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
