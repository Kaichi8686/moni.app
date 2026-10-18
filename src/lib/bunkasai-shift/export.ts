import { SLOTS, formatSlotTitle } from "./schedule";
import type { Assignments, Member } from "./types";

export function formatShiftText(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const lines: string[] = ["【文化祭シフト表】", ""];

  let currentDay = "";
  for (const slot of SLOTS) {
    if (slot.dayLabel !== currentDay) {
      currentDay = slot.dayLabel;
      lines.push(`■ ${currentDay}`);
    }
    const names = assignments[slot.id]
      .map((id) => byId.get(id) ?? "(不明)")
      .join("、");
    lines.push(
      `${slot.start}–${slot.end}（${assignments[slot.id].length}/${slot.needed}人）`,
    );
    lines.push(names || "（未割当）");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatShiftCsv(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const header = ["日程", "開始", "終了", "必要人数", "割当人数", "メンバー"];
  const rows = SLOTS.map((slot) => {
    const names = assignments[slot.id]
      .map((id) => byId.get(id) ?? "")
      .filter(Boolean)
      .join(" / ");
    return [
      slot.dayLabel,
      slot.start,
      slot.end,
      String(slot.needed),
      String(assignments[slot.id].length),
      names,
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
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

export { formatSlotTitle };
