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

function orderedMembers(members: Member[], assignments: Assignments): {
  assigned: Member[];
  unassigned: Member[];
} {
  const assignedIds = new Set<string>();
  for (const slot of SLOTS) {
    for (const id of assignments[slot.id]) assignedIds.add(id);
  }
  const assigned = [...members]
    .filter((m) => assignedIds.has(m.id))
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"));
  const unassigned = members
    .filter((m) => !assignedIds.has(m.id))
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"));
  return { assigned, unassigned };
}

function pad(str: string, width: number): string {
  const chars = [...str];
  let w = 0;
  for (const ch of chars) {
    w += ch.charCodeAt(0) > 0xff ? 2 : 1;
  }
  return str + " ".repeat(Math.max(0, width - w));
}

/**
 * LINE貼り付け用のスプレッドシート風テキスト。
 * タブ区切りマトリクスを中心にし、チャットでもシートでも使える形にする。
 */
export function formatShiftText(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, safeName(m.name)]));
  const { assigned, unassigned } = orderedMembers(members, assignments);
  const matrixMembers = assigned.length > 0 ? assigned : [...members].sort((a, b) =>
    safeName(a.name).localeCompare(safeName(b.name), "ja"),
  );

  const lines: string[] = ["【文化祭シフト表】", ""];

  // --- 時間帯ごとの名簿（読みやすい一覧） ---
  let day = "";
  for (const slot of SLOTS) {
    if (slot.dayLabel !== day) {
      day = slot.dayLabel;
      lines.push(`■ ${day}`);
    }
    const ids = assignments[slot.id];
    const flag =
      ids.length < slot.needed ? " 【不足】" : ids.length > slot.needed ? " 【超過】" : "";
    lines.push(`${slot.start}-${slot.end}  ${ids.length}/${slot.needed}人${flag}`);
    const names = ids.map((id) => byId.get(id) ?? "?");
    if (names.length === 0) {
      lines.push("  (未割当)");
    } else {
      // 3人ずつで折り返し
      for (let i = 0; i < names.length; i += 3) {
        lines.push(`  ${names.slice(i, i + 3).join(" / ")}`);
      }
    }
    lines.push("");
  }

  // --- スプレッドシート風マトリクス（タブ区切り＝LINEからSheetsへ貼れる） ---
  lines.push("■ メンバー表（タブ区切り・シートにそのまま貼れます）");
  const headers = ["名前", ...SLOTS.map((s) => slotShortLabel(s)), "合計"];
  lines.push(headers.join("\t"));
  for (const m of matrixMembers) {
    const marks = SLOTS.map((slot) =>
      assignments[slot.id].includes(m.id) ? "○" : "",
    );
    const total = marks.filter(Boolean).length;
    lines.push([safeName(m.name), ...marks, String(total)].join("\t"));
  }

  // --- 等幅っぽい見本（チャットで表に見える） ---
  lines.push("");
  lines.push("■ 見やすい表（○=担当）");
  const nameW = Math.min(
    14,
    Math.max(6, ...matrixMembers.map((m) => [...safeName(m.name)].length + 2)),
  );
  const colW = 8;
  const head =
    pad("名前", nameW) +
    SLOTS.map((s) => pad(slotShortLabel(s).replace("日目", "日"), colW)).join("") +
    "合計";
  lines.push(head);
  lines.push("-".repeat(Math.min(80, head.length)));
  for (const m of matrixMembers) {
    const marks = SLOTS.map((slot) =>
      pad(assignments[slot.id].includes(m.id) ? "○" : "・", colW),
    );
    const total = SLOTS.filter((slot) => assignments[slot.id].includes(m.id)).length;
    lines.push(pad(safeName(m.name), nameW) + marks.join("") + String(total));
  }

  if (unassigned.length > 0) {
    lines.push("");
    lines.push(`■ 未割当: ${unassigned.map((m) => safeName(m.name)).join(" / ")}`);
  }

  return lines.join("\n").trimEnd();
}

/** スプレッドシートにそのまま貼れるTSV（マトリクスのみ） */
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

/** 時間帯ごとの名簿TSV（1行=1コマ） */
export function formatSlotRosterTsv(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, safeName(m.name)]));
  const header = ["日程", "開始", "終了", "必要", "割当", "メンバー"];
  const rows = SLOTS.map((slot) => {
    const names = assignments[slot.id]
      .map((id) => byId.get(id) ?? "")
      .filter(Boolean)
      .join("、");
    return [
      slot.dayLabel,
      slot.start,
      slot.end,
      String(slot.needed),
      String(assignments[slot.id].length),
      names,
    ].join("\t");
  });
  return [header.join("\t"), ...rows].join("\n");
}

export function formatShiftCsv(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, safeName(m.name)]));
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

  const matrixHeader = [
    "名前",
    ...SLOTS.map((s) => `${s.dayLabel}_${s.start}`),
    "合計",
  ];
  const matrixRows = [...members]
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"))
    .map((m) => {
      const marks = SLOTS.map((slot) =>
        assignments[slot.id].includes(m.id) ? "○" : "",
      );
      const total = marks.filter(Boolean).length;
      return [safeName(m.name), ...marks, String(total)].map(csvEscape).join(",");
    });

  return [
    header.join(","),
    ...rows,
    "",
    matrixHeader.join(","),
    ...matrixRows,
  ].join("\n");
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

export type MatrixRow = {
  id: string;
  name: string;
  marks: boolean[];
  total: number;
};

export function buildMatrixRows(members: Member[], assignments: Assignments): MatrixRow[] {
  return [...members]
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"))
    .map((m) => {
      const marks = SLOTS.map((slot) => assignments[slot.id].includes(m.id));
      return {
        id: m.id,
        name: safeName(m.name),
        marks,
        total: marks.filter(Boolean).length,
      };
    });
}

export { formatSlotTitle, slotShortLabel, slotHeader, SLOTS };
