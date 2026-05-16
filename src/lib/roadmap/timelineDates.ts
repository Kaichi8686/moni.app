import { differenceInCalendarDays, startOfMonth } from "date-fns";

/** DBの timestamptz をローカル日付として扱う（UTCずれ防止） */
export function phaseLocalDay(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function phaseBarLayout(
  startIso: string,
  endIso: string,
  anchor: Date,
  pxPerDay: number,
): { left: number; width: number; durationDays: number } {
  const start = phaseLocalDay(startIso);
  let end = phaseLocalDay(endIso);
  if (end.getTime() < start.getTime()) end = start;

  const durationDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const left = differenceInCalendarDays(start, anchor) * pxPerDay;
  const rawWidth = durationDays * pxPerDay;
  const width = Math.max(88, rawWidth);

  return { left, width, durationDays };
}

export function timelineAnchorForPhases(
  phases: { startDate: string; endDate: string }[],
): Date {
  if (phases.length === 0) {
    const t = new Date();
    return startOfMonth(t);
  }
  let min = phaseLocalDay(phases[0].startDate).getTime();
  for (const p of phases) {
    min = Math.min(min, phaseLocalDay(p.startDate).getTime(), phaseLocalDay(p.endDate).getTime());
  }
  return startOfMonth(new Date(min));
}

export function scrollLeftForPhase(startIso: string, anchor: Date, pxPerDay: number): number {
  const start = phaseLocalDay(startIso);
  return Math.max(0, differenceInCalendarDays(start, anchor) * pxPerDay - 48);
}
