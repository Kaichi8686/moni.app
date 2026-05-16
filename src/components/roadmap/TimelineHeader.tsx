"use client";

import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import type { TimelineZoom } from "@/lib/workspace/types";
import { pxPerDay } from "@/lib/workspace/timelineLayout";

type Props = {
  anchor: Date;
  totalDays: number;
  zoom: TimelineZoom;
  onZoomChange: (z: TimelineZoom) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function TimelineHeader({ anchor, totalDays, zoom, onZoomChange, onPrev, onNext, onToday }: Props) {
  const ppd = pxPerDay(zoom);
  const width = totalDays * ppd;
  const monthTicks: { offset: number; label: string }[] = [];
  let lastM = "";
  for (let i = 0; i < totalDays; i += 1) {
    const day = addDays(anchor, i);
    const m = format(day, "yyyy-MM", { locale: ja });
    if (m !== lastM) {
      lastM = m;
      monthTicks.push({ offset: i * ppd, label: format(day, "M月", { locale: ja }) });
    }
  }

  const todayOffset = differenceInCalendarDays(new Date(), anchor) * ppd;

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-2 py-2">
        <select
          value={zoom}
          onChange={(e) => onZoomChange(e.target.value as TimelineZoom)}
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] font-medium text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
        >
          <option value="month">月表示</option>
          <option value="week">週表示</option>
          <option value="quarter">四半期</option>
        </select>
        <button
          type="button"
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] font-semibold text-[#1A1A1A] transition-all duration-150 hover:bg-[#F7F8F8]"
          onClick={onToday}
        >
          今日
        </button>
        <button
          type="button"
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] font-semibold text-[#1A1A1A] transition-all duration-150 hover:bg-[#F7F8F8]"
          onClick={onPrev}
        >
          ← 前へ
        </button>
        <button
          type="button"
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[12px] font-semibold text-[#1A1A1A] transition-all duration-150 hover:bg-[#F7F8F8]"
          onClick={onNext}
        >
          次へ →
        </button>
      </div>
      <div className="relative overflow-hidden border-b border-[#E5E7EB]" style={{ width }}>
        <div className="relative h-9">
          {monthTicks.map((t) => (
            <span
              key={`${t.label}-${t.offset}`}
              className="absolute top-1 text-[11px] font-semibold text-[#6B7280]"
              style={{ left: t.offset + 4 }}
            >
              {t.label}
            </span>
          ))}
        </div>
        {todayOffset >= 0 && todayOffset <= width ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-500"
            style={{ left: todayOffset }}
            title="今日"
          />
        ) : null}
      </div>
    </div>
  );
}
