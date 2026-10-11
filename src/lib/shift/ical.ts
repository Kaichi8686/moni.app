import type { ShiftAssignmentResult, ShiftBoard, ShiftResponse } from "@/lib/shift/types";

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toIcsDate(date: string, hhmm: string): string {
  const clean = (hhmm || "00:00").replace(":", "");
  const d = (date || "19700101").replace(/-/g, "");
  return `${d}T${clean.padEnd(4, "0")}00`;
}

/** 指定メンバーの割当を iCal にする */
export function buildPersonalIcs(
  board: ShiftBoard,
  result: ShiftAssignmentResult,
  personName: string,
): string {
  const dayMap = new Map(board.days.map((d) => [d.id, d]));
  const slotMap = new Map(board.slots.map((s) => [s.id, s]));
  const roleMap = new Map(board.roles.map((r) => [r.id, r]));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShiftMaking//JP",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(board.title)} (${icsEscape(personName)})`,
  ];

  let n = 0;
  for (const cell of result.cells) {
    if (!cell.people.some((p) => p.name === personName)) continue;
    const day = dayMap.get(cell.dayId);
    const slot = slotMap.get(cell.slotId);
    const role = roleMap.get(cell.roleId);
    if (!day || !slot || !role || !day.date || !slot.start || !slot.end) continue;
    n += 1;
    lines.push(
      "BEGIN:VEVENT",
      `UID:shift-${board.code}-${cell.dayId}-${cell.slotId}-${cell.roleId}-${n}@shiftmaking`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsDate(day.date, slot.start)}`,
      `DTEND:${toIcsDate(day.date, slot.end)}`,
      `SUMMARY:${icsEscape(`${role.name} / ${board.title}`)}`,
      `DESCRIPTION:${icsEscape(`${day.label} ${slot.label} — ${personName}`)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function myAssignedCells(
  board: ShiftBoard,
  result: ShiftAssignmentResult | null,
  name: string,
) {
  if (!result || !name.trim()) return [];
  return result.cells.filter((c) => c.people.some((p) => p.name === name.trim()));
}

export function findResponseByName(responses: ShiftResponse[], name: string): ShiftResponse | undefined {
  const n = name.trim();
  return responses.find((r) => r.name === n);
}
