import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import type { TimelineZoom } from "@/lib/workspace/types";

export const PX_PER_DAY_MONTH = 4;
export const PX_PER_DAY_WEEK = 12;
export const PX_PER_DAY_QUARTER = 1.2;

export function pxPerDay(zoom: TimelineZoom): number {
  if (zoom === "week") return PX_PER_DAY_WEEK;
  if (zoom === "quarter") return PX_PER_DAY_QUARTER;
  return PX_PER_DAY_MONTH;
}

export function timelineRange(viewStart: Date, zoom: TimelineZoom): { start: Date; end: Date; totalDays: number; widthPx: number } {
  const start = startOfMonth(viewStart);
  const end =
    zoom === "quarter"
      ? addDays(start, 365)
      : zoom === "week"
        ? addDays(start, 28)
        : addDays(endOfMonth(start), 62);
  const totalDays = Math.max(30, differenceInCalendarDays(end, start) + 1);
  const ppd = pxPerDay(zoom);
  return { start, end, totalDays, widthPx: totalDays * ppd };
}

export function offsetForDate(anchor: Date, date: Date, pxPerDay: number): number {
  return differenceInCalendarDays(date, anchor) * pxPerDay;
}

export function daysFromDeltaPx(deltaX: number, pxPerDay: number): number {
  return Math.round(deltaX / pxPerDay);
}

export function formatMonthHeader(d: Date): string {
  return format(d, "M月", { locale: ja });
}
