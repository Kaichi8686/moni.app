import { SLOTS, formatSlotTitle } from "./schedule";
import type { Assignments, Member, ShiftSlot } from "./types";

/** LINE・シートで壊れやすい文字を避ける */
function safeName(name: string): string {
  return name
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u3000/g, " ")
    .trim();
}

function slotShortLabel(slot: ShiftSlot): string {
  return `${slot.dayLabel}${slot.start}`;
}

function slotHeader(slot: ShiftSlot): string {
  return `${slot.dayLabel}\n${slot.start}-${slot.end}`;
}

function nameById(members: Member[]): Map<string, string> {
  return new Map(members.map((m) => [m.id, safeName(m.name)]));
}

function unassignedMembers(members: Member[], assignments: Assignments): Member[] {
  const assignedIds = new Set<string>();
  for (const slot of SLOTS) {
    for (const id of assignments[slot.id]) assignedIds.add(id);
  }
  return members
    .filter((m) => !assignedIds.has(m.id))
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"));
}

export type SlotRosterRow = {
  slot: ShiftSlot;
  names: string[];
  count: number;
  needed: number;
  short: boolean;
  over: boolean;
};

export function buildSlotRosterRows(
  members: Member[],
  assignments: Assignments,
): SlotRosterRow[] {
  const byId = nameById(members);
  return SLOTS.map((slot) => {
    const names = assignments[slot.id]
      .map((id) => byId.get(id) ?? "?")
      .sort((a, b) => a.localeCompare(b, "ja"));
    return {
      slot,
      names,
      count: names.length,
      needed: slot.needed,
      short: names.length < slot.needed,
      over: names.length > slot.needed,
    };
  });
}

/**
 * LINE・コピー用本文。時間帯に誰が入っているか（人数表記なし）。
 */
export function formatShiftText(members: Member[], assignments: Assignments): string {
  const rows = buildSlotRosterRows(members, assignments);
  const lines: string[] = ["【文化祭シフト表】", ""];

  let day = "";
  for (const row of rows) {
    if (row.slot.dayLabel !== day) {
      day = row.slot.dayLabel;
      lines.push(`■ ${day}`);
      lines.push(["時間", "メンバー"].join("\t"));
    }
    lines.push(
      [
        `${row.slot.start}-${row.slot.end}`,
        row.names.length > 0 ? row.names.join("、") : "（未割当）",
      ].join("\t"),
    );
  }

  const unassigned = unassignedMembers(members, assignments);
  if (unassigned.length > 0) {
    lines.push("");
    lines.push(`■ 未割当: ${unassigned.map((m) => safeName(m.name)).join("、")}`);
  }

  return lines.join("\n").trimEnd();
}

/** 時間帯×メンバーのシート用TSV（人数なし・名前は1セル） */
export function formatSlotRosterTsv(members: Member[], assignments: Assignments): string {
  const rows = buildSlotRosterRows(members, assignments);
  const header = ["日程", "開始", "終了", "メンバー"];
  const body = rows.map((row) =>
    [
      row.slot.dayLabel,
      row.slot.start,
      row.slot.end,
      row.names.join("、"),
    ].join("\t"),
  );
  return [header.join("\t"), ...body].join("\n");
}

/** メンバー×時間のマトリクスTSV（補助） */
export function formatShiftTsv(members: Member[], assignments: Assignments): string {
  const headers = ["名前", ...SLOTS.map((s) => `${s.dayLabel} ${s.start}-${s.end}`), "合計"];
  const rows = [...members]
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"))
    .map((m) => {
      const marks = SLOTS.map((slot) =>
        assignments[slot.id].includes(m.id) ? "○" : "",
      );
      const total = marks.filter(Boolean).length;
      return [safeName(m.name), ...marks, String(total)].join("\t");
    });
  return [headers.join("\t"), ...rows].join("\n");
}

export function formatShiftCsv(members: Member[], assignments: Assignments): string {
  const rows = buildSlotRosterRows(members, assignments);
  const header = ["日程", "開始", "終了", "メンバー"];
  const body = rows.map((row) =>
    [row.slot.dayLabel, row.slot.start, row.slot.end, row.names.join("、")]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { formatSlotTitle, slotShortLabel, slotHeader, SLOTS };
