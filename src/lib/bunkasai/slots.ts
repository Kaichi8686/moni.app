export const SLOT_CAPACITY = 9;

export type SlotId = "slot1" | "slot2" | "slot3" | "slot4";

export type FestivalSlot = {
  id: SlotId;
  title: string;
  time: string;
  hint: string;
};

/** 文化祭当日の4時間帯（必要ならここだけ書き換えてください） */
export const FESTIVAL_SLOTS: FestivalSlot[] = [
  { id: "slot1", title: "第1部", time: "10:00 – 11:30", hint: "午前の前半" },
  { id: "slot2", title: "第2部", time: "11:30 – 13:00", hint: "午前の後半" },
  { id: "slot3", title: "第3部", time: "13:00 – 14:30", hint: "午後の前半" },
  { id: "slot4", title: "第4部", time: "14:30 – 16:00", hint: "午後の後半" },
];

export function isSlotId(value: string): value is SlotId {
  return FESTIVAL_SLOTS.some((s) => s.id === value);
}
