export type SlotId =
  | "d1-s1"
  | "d1-s2"
  | "d1-s3"
  | "d1-s4"
  | "d2-s1"
  | "d2-s2"
  | "d2-s3";

export type DayId = "d1" | "d2";

export type ShiftSlot = {
  id: SlotId;
  dayId: DayId;
  dayLabel: string;
  label: string;
  start: string;
  end: string;
  needed: number;
};

/** 1人あたりの担当コマ上限のデフォルト（全7コマ中） */
export const DEFAULT_MAX_SHIFTS = 3;
export const MIN_MAX_SHIFTS = 1;
export const MAX_MAX_SHIFTS = 7;

export type Member = {
  id: string;
  name: string;
  /** 参加できない時間帯 */
  ngSlotIds: SlotId[];
  /** 担当できるコマ数の上限（1〜7） */
  maxShifts: number;
};

export function clampMaxShifts(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_SHIFTS;
  return Math.min(MAX_MAX_SHIFTS, Math.max(MIN_MAX_SHIFTS, Math.floor(n)));
}

export function normalizeMember(raw: Partial<Member> & { id: string; name: string }): Member {
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").trim().slice(0, 40),
    ngSlotIds: Array.isArray(raw.ngSlotIds) ? (raw.ngSlotIds as Member["ngSlotIds"]) : [],
    maxShifts: clampMaxShifts(raw.maxShifts),
  };
}

/**
 * 片方向の同伴必須。
 * memberId を入れるコマには、requiresId も必ず入れる。
 * requiresId だけなら memberId は不要。
 */
export type MemberDependency = {
  id: string;
  memberId: string;
  requiresId: string;
};

/** @deprecated 旧相互ペア。読み込み時に dependency へ移行 */
export type MemberPair = {
  id: string;
  memberIds: [string, string];
};

export type AssignOptions = {
  /** 各時間帯にこの中のだれか1人以上入れる */
  coreMemberIds?: string[];
  /** 「この人にはこの人がいないとダメ」 */
  dependencies?: MemberDependency[];
};

/** slotId → 割り当てられた memberId 一覧 */
export type Assignments = Record<SlotId, string[]>;

export type AssignWarning = {
  slotId: SlotId;
  message: string;
  shortfall: number;
};

export type AssignResult = {
  assignments: Assignments;
  warnings: AssignWarning[];
};
