import type { ShiftScheduleConfig, ShiftSlot } from "@/lib/shift/types";

export { slotsForDay, workSlotsForDay } from "@/lib/shift/types";

function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 開始〜終了を slotMinutes で刻み、休み時間は isBreak コマとして挿入 */
export function generateSlotsFromSchedule(schedule: ShiftScheduleConfig): ShiftSlot[] {
  const start = toMinutes(schedule.dayStart);
  const end = toMinutes(schedule.dayEnd);
  const step = Math.max(5, Math.min(480, Math.floor(schedule.slotMinutes || 60)));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [{ id: "s1", label: "終日", start: schedule.dayStart, end: schedule.dayEnd }];
  }

  const breaks = [...(schedule.breaks ?? [])].sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start),
  );

  const slots: ShiftSlot[] = [];
  let cursor = start;
  let workIndex = 0;
  let i = 0;

  while (cursor < end && i < 80) {
    i += 1;
    const br = breaks.find((b) => {
      const bs = toMinutes(b.start);
      return Number.isFinite(bs) && cursor >= bs && cursor < toMinutes(b.end);
    });
    if (br) {
      const be = Math.min(end, toMinutes(br.end));
      slots.push({
        id: `b${slots.length + 1}`,
        label: br.label || "休み時間",
        start: toHHMM(cursor),
        end: toHHMM(be),
        isBreak: true,
      });
      cursor = be;
      continue;
    }

    const nextBreak = breaks.find((b) => toMinutes(b.start) > cursor);
    const hardEnd = nextBreak ? Math.min(end, toMinutes(nextBreak.start)) : end;
    const slotEnd = Math.min(cursor + step, hardEnd);
    if (slotEnd <= cursor) break;

    workIndex += 1;
    slots.push({
      id: `s${workIndex}`,
      label: `${toHHMM(cursor)}-${toHHMM(slotEnd)}`,
      start: toHHMM(cursor),
      end: toHHMM(slotEnd),
      isBreak: false,
    });
    cursor = slotEnd;
  }

  return slots.length > 0 ? slots : [{ id: "s1", label: "枠1" }];
}

export function workSlots(slots: ShiftSlot[]): ShiftSlot[] {
  return slots.filter((s) => !s.isBreak);
}
