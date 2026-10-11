/** 文化祭シフト合わせ — スタンドアロン（moniログイン不要） */

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
};

export type ShiftRole = {
  id: string;
  name: string;
  /** 1コマあたりの必要人数 */
  needed: number;
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
  createdAt: string;
  updatedAt: string;
  /** 自動割り振り結果（未実行なら null） */
  assignments: ShiftAssignmentResult | null;
};

export type ShiftResponse = {
  id: string;
  boardId: string;
  name: string;
  /** day:slot → 希望 */
  prefs: Record<ShiftCellKey, Pref>;
  /** やりたい役割 ID */
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
  /** 誰が何コマ入ったか */
  loadByResponseId: Record<string, number>;
  unassignedNames: string[];
};

export type PublicBoard = Omit<ShiftBoard, "adminKey"> & {
  responseCount: number;
};

export type CreateBoardInput = {
  title: string;
  note?: string;
  days: Array<{ label: string; date?: string }>;
  slots: Array<{ label: string; start?: string; end?: string }>;
  roles: Array<{ name: string; needed: number }>;
};

export function cellKey(dayId: string, slotId: string): ShiftCellKey {
  return `${dayId}:${slotId}`;
}

export function parseCellKey(key: ShiftCellKey): { dayId: string; slotId: string } {
  const i = key.indexOf(":");
  return { dayId: key.slice(0, i), slotId: key.slice(i + 1) };
}
