import type { DayId, ShiftSlot, SlotId } from "./types";

export const NEEDED = 9;

export const SLOTS: ShiftSlot[] = [
  {
    id: "d1-s1",
    dayId: "d1",
    dayLabel: "1日目",
    label: "1コマ目",
    start: "08:45",
    end: "10:00",
    needed: NEEDED,
  },
  {
    id: "d1-s2",
    dayId: "d1",
    dayLabel: "1日目",
    label: "2コマ目",
    start: "10:00",
    end: "12:00",
    needed: NEEDED,
  },
  {
    id: "d1-s3",
    dayId: "d1",
    dayLabel: "1日目",
    label: "3コマ目",
    start: "12:00",
    end: "14:00",
    needed: NEEDED,
  },
  {
    id: "d1-s4",
    dayId: "d1",
    dayLabel: "1日目",
    label: "4コマ目",
    start: "14:00",
    end: "15:30",
    needed: NEEDED,
  },
  {
    id: "d2-s1",
    dayId: "d2",
    dayLabel: "2日目",
    label: "1コマ目",
    start: "08:45",
    end: "10:00",
    needed: NEEDED,
  },
  {
    id: "d2-s2",
    dayId: "d2",
    dayLabel: "2日目",
    label: "2コマ目",
    start: "10:00",
    end: "12:00",
    needed: NEEDED,
  },
  {
    id: "d2-s3",
    dayId: "d2",
    dayLabel: "2日目",
    label: "3コマ目",
    start: "12:00",
    end: "14:00",
    needed: NEEDED,
  },
];

export const SLOT_IDS = SLOTS.map((s) => s.id);

export function slotById(id: SlotId): ShiftSlot {
  const slot = SLOTS.find((s) => s.id === id);
  if (!slot) throw new Error(`Unknown slot: ${id}`);
  return slot;
}

export function slotsForDay(dayId: DayId): ShiftSlot[] {
  return SLOTS.filter((s) => s.dayId === dayId);
}

export function emptyAssignments(): Record<SlotId, string[]> {
  return {
    "d1-s1": [],
    "d1-s2": [],
    "d1-s3": [],
    "d1-s4": [],
    "d2-s1": [],
    "d2-s2": [],
    "d2-s3": [],
  };
}

export function formatSlotTitle(slot: ShiftSlot): string {
  return `${slot.dayLabel} ${slot.start}–${slot.end}`;
}
