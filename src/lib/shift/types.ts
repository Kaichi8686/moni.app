/** シフトメイキング — スタンドアロン（ログイン不要） */

export type Pref = "prefer" | "ok" | "ng";

export type ShiftDay = {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD（任意）
};

export type ShiftSlot = {
  id: string;
  label: string;
  /** 例: "10:00" */
  start?: string;
  /** 例: "13:00" */
  end?: string;
  /** 休み時間（誰も入れない） */
  isBreak?: boolean;
};

export type ShiftBreak = {
  id: string;
  label: string;
  start: string; // HH:mm
  end: string;
};

export type ShiftRole = {
  id: string;
  name: string;
  /** 1コマあたりの必要人数 */
  needed: number;
};

/** バディ（なるべく同じコマに入れる） */
export type ShiftBuddyPair = {
  id: string;
  nameA: string;
  nameB: string;
};

export type ShiftScheduleConfig = {
  /** 営業/公開の開始 HH:mm */
  dayStart: string;
  /** 終了 HH:mm */
  dayEnd: string;
  /** 何分ごとにシフトを切り替えるか */
  slotMinutes: number;
  breaks: ShiftBreak[];
  /** 連続で入れる最大コマ数（0=制限なし） */
  maxConsecutive: number;
  buddyPairs: ShiftBuddyPair[];
};

export type ShiftCellKey = string; // `${dayId}:${slotId}`

export type ShiftBoard = {
  id: string;
  code: string;
  adminKey: string;
  title: string;
  note: string;
  days: ShiftDay[];
  slots: ShiftSlot[];
  roles: ShiftRole[];
  schedule: ShiftScheduleConfig;
  createdAt: string;
  updatedAt: string;
  assignments: ShiftAssignmentResult | null;
};

export type ShiftResponse = {
  id: string;
  boardId: string;
  name: string;
  prefs: Record<ShiftCellKey, Pref>;
  preferredRoleIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type AssignedPerson = {
  responseId: string;
  name: string;
  pref: Pref;
};

export type CellAssignment = {
  dayId: string;
  slotId: string;
  roleId: string;
  needed: number;
  people: AssignedPerson[];
  shortfall: number;
};

export type ShiftAssignmentResult = {
  generatedAt: string;
  cells: CellAssignment[];
  loadByResponseId: Record<string, number>;
  unassignedNames: string[];
};

export type CreateBoardInput = {
  title: string;
  note?: string;
  days: Array<{ label: string; date?: string }>;
  roles: Array<{ name: string; needed: number }>;
  schedule: ShiftScheduleConfig;
  /** 手動スロットを渡す場合（通常は schedule から生成） */
  slots?: Array<{ label: string; start?: string; end?: string; isBreak?: boolean }>;
};

export type UpdateBoardInput = {
  title?: string;
  note?: string;
  days?: Array<{ label: string; date?: string }>;
  roles?: Array<{ name: string; needed: number }>;
  schedule?: ShiftScheduleConfig;
};

export const DEFAULT_SCHEDULE: ShiftScheduleConfig = {
  dayStart: "09:00",
  dayEnd: "17:00",
  slotMinutes: 60,
  breaks: [{ id: "br1", label: "昼休み", start: "12:00", end: "13:00" }],
  maxConsecutive: 2,
  buddyPairs: [],
};

export function cellKey(dayId: string, slotId: string): ShiftCellKey {
  return `${dayId}:${slotId}`;
}

export function parseCellKey(key: ShiftCellKey): { dayId: string; slotId: string } {
  const i = key.indexOf(":");
  return { dayId: key.slice(0, i), slotId: key.slice(i + 1) };
}

export function normalizeBoard(board: ShiftBoard): ShiftBoard {
  return {
    ...board,
    schedule: board.schedule ?? { ...DEFAULT_SCHEDULE, breaks: [], buddyPairs: [] },
    slots: (board.slots ?? []).map((s) => ({ ...s, isBreak: Boolean(s.isBreak) })),
  };
}
