import { SLOTS, formatSlotTitle } from "./schedule";
import type { Assignments, Member } from "./types";

/** LINEで壊れやすい文字を避ける */
function safeName(name: string): string {
  return name
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u3000/g, " ")
    .trim();
}

function slotShortLabel(slot: (typeof SLOTS)[number]): string {
  return `${slot.dayLabel}${slot.start.replace(":", "")}`;
}

/**
 * スプレッドシート風のマトリクス（名前×時間）。
 * LINE貼り付け・コピー用。特殊ダッシュは使わない。
 */
export function formatShiftText(members: Member[], assignments: Assignments): string {
  const byId = new Map(members.map((m) => [m.id, safeName(m.name)]));

  // 割当がある人を上に、名前順
  const assignedIds = new Set<string>();
  for (const slot of SLOTS) {
    for (const id of assignments[slot.id]) assignedIds.add(id);
  }
  const ordered = [...members]
    .filter((m) => assignedIds.has(m.id))
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"));
  const unassigned = members.filter((m) => !assignedIds.has(m.id));

  const headers = SLOTS.map(
    (s) => `${s.dayLabel} ${s.start}-${s.end}`,
  );

  const lines: string[] = [
    "【文化祭シフト表】",
    "",
    "■ 時間帯ごとの人数",
  ];

  let day = "";
  for (const slot of SLOTS) {
    if (slot.dayLabel !== day) {
      day = slot.dayLabel;
      lines.push(`-- ${day} --`);
    }
    const n = assignments[slot.id].length;
    const flag = n < slot.needed ? " 不足" : n > slot.needed ? " 超過" : "";
    lines.push(
      `${slot.start}-${slot.end}  ${n}/${slot.needed}人${flag}`,
    );
  }

  lines.push("");
  lines.push("■ メンバー表 (o=担当)");
  lines.push(["名前", ...headers, "合計"].join(" | "));
  lines.push(
    ["----", ...headers.map(() => "----"), "----"].join(" | "),
  );

  for (const m of ordered) {
    const marks = SLOTS.map((slot) =>
      assignments[slot.id].includes(m.id) ? "o" : "-",
    );
    const total = marks.filter((x) => x === "o").length;
    lines.push([safeName(m.name), ...marks, String(total)].join(" | "));
  }

  lines.push("");
  lines.push("■ コマ別メンバー一覧");
  day = "";
  for (const slot of SLOTS) {
    if (slot.dayLabel !== day) {
      day = slot.dayLabel;
      lines.push(`-- ${day} --`);
    }
    const names = assignments[slot.id]
      .map((id) => byId.get(id) ?? "?")
      .join(" / ");
    lines.push(
      `${slot.start}-${slot.end} (${assignments[slot.id].length}/${slot.needed})`,
    );
    lines.push(names || "(未割当)");
  }

  if (unassigned.length > 0) {
    lines.push("");
    lines.push(
      `■ 未割当: ${unassigned.map((m) => safeName(m.name)).join(" / ")}`,
    );
  }

  return lines.join("\n").trimEnd();
}

/** スプレッドシートにそのまま貼れるTSV */
export function formatShiftTsv(members: Member[], assignments: Assignments): string {
  const headers = ["名前", ...SLOTS.map((s) => `${s.dayLabel} ${s.start}-${s.end}`), "合計"];
  const rows = members
    .slice()
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"))
    .map((m) => {
      const marks = SLOTS.map((slot) =>
        assignments[slot.id].includes(m.id) ? "o" : "",
      );
      const total = marks.filter(Boolean).length;
      return [safeName(m.name), ...marks, String(total)].join("\t");
    });
  return [headers.join("\t"), ...rows].join("\n");
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

  // マトリクスシート用の2枚目相当を続けて出す
  const matrixHeader = [
    "名前",
    ...SLOTS.map((s) => `${s.dayLabel}_${s.start}`),
    "合計",
  ];
  const matrixRows = members
    .slice()
    .sort((a, b) => safeName(a.name).localeCompare(safeName(b.name), "ja"))
    .map((m) => {
      const marks = SLOTS.map((slot) =>
        assignments[slot.id].includes(m.id) ? "o" : "",
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

export { formatSlotTitle, slotShortLabel };
