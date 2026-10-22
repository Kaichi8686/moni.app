import { emptyAssignments, SLOTS } from "./schedule";
import type {
  AssignWarning,
  Assignments,
  Member,
  MemberDependency,
  SlotId,
} from "./types";
import { DEFAULT_MAX_SHIFTS, normalizeMember } from "./types";

export const SHIFT_BACKUP_KIND = "bunkasai-shift-v1";

export type ShiftBackup = {
  kind: typeof SHIFT_BACKUP_KIND;
  exportedAt: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  dependencies: MemberDependency[];
};

export type ShiftImportResult = {
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  dependencies: MemberDependency[];
  /** インポートで新規追加した名前 */
  createdNames: string[];
  /** 割当に出てきたが見つからなかった名前（通常は空） */
  unmatchedNames: string[];
};

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeName(name: string): string {
  return name
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u3000/g, " ")
    .trim();
}

function normalizeAssignments(raw: unknown): Assignments {
  const base = emptyAssignments();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const slot of SLOTS) {
    const ids = obj[slot.id];
    if (Array.isArray(ids)) {
      base[slot.id] = ids.map(String).filter(Boolean);
    }
  }
  return base;
}

function splitNames(cell: string): string[] {
  return cell
    .split(/[、,\/／|｜]/)
    .map((n) => safeName(n))
    .filter((n) => n && n !== "（未割当）" && n !== "(未割当)" && n !== "-");
}

/** CSV 1行を簡易パース（ダブルクォート対応） */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function findSlot(dayLabel: string, start: string, end: string) {
  const day = safeName(dayLabel);
  const s = safeName(start).replace("：", ":");
  const e = safeName(end).replace("：", ":");
  if (day) {
    return (
      SLOTS.find(
        (slot) =>
          slot.dayLabel === day && slot.start === s && slot.end === e,
      ) ?? null
    );
  }
  // 日程不明のときは最初に一致するコマ（CSVに日列がある場合は使わない）
  return SLOTS.find((slot) => slot.start === s && slot.end === e) ?? null;
}

function ensureMember(
  name: string,
  byName: Map<string, Member>,
  members: Member[],
  created: string[],
): Member | null {
  const key = safeName(name);
  if (!key) return null;
  const existing = byName.get(key);
  if (existing) return existing;
  const m = normalizeMember({
    id: uid(),
    name: key,
    ngSlotIds: [],
    mustSlotIds: [],
    maxShifts: DEFAULT_MAX_SHIFTS,
  });
  members.push(m);
  byName.set(key, m);
  created.push(key);
  return m;
}

function importFromBackupJson(
  parsed: Record<string, unknown>,
  existingMembers: Member[],
): ShiftImportResult {
  const rawMembers = Array.isArray(parsed.members) ? parsed.members : [];
  if (rawMembers.length === 0) {
    throw new Error("名簿データがありません");
  }

  const members = rawMembers.map((m) => {
    const row = m as Partial<Member> & { id?: string; name?: string };
    return normalizeMember({
      id: String(row.id || uid()),
      name: String(row.name || "").trim(),
      ngSlotIds: row.ngSlotIds,
      mustSlotIds: row.mustSlotIds,
      maxShifts: row.maxShifts,
    });
  });

  // 既存メンバーの NG 等を、同名なら引き継ぎ（バックアップに無い場合）
  const existingByName = new Map(existingMembers.map((m) => [safeName(m.name), m]));
  const merged = members.map((m) => {
    const prev = existingByName.get(safeName(m.name));
    if (!prev) return m;
    return normalizeMember({
      ...m,
      ngSlotIds: m.ngSlotIds.length > 0 ? m.ngSlotIds : prev.ngSlotIds,
      mustSlotIds: m.mustSlotIds.length > 0 ? m.mustSlotIds : prev.mustSlotIds,
      maxShifts: m.maxShifts ?? prev.maxShifts,
    });
  });

  const memberIds = new Set(merged.map((m) => m.id));
  const assignments = normalizeAssignments(parsed.assignments);
  // 存在しない id を落とす
  for (const slot of SLOTS) {
    assignments[slot.id] = assignments[slot.id].filter((id) => memberIds.has(id));
  }

  return {
    members: merged,
    assignments,
    warnings: Array.isArray(parsed.warnings) ? (parsed.warnings as AssignWarning[]) : [],
    lastAssignedAt:
      typeof parsed.lastAssignedAt === "string" || parsed.lastAssignedAt === null
        ? (parsed.lastAssignedAt as string | null)
        : new Date().toISOString(),
    coreMemberIds: Array.isArray(parsed.coreMemberIds)
      ? parsed.coreMemberIds.map(String).filter((id) => memberIds.has(id))
      : [],
    dependencies: Array.isArray(parsed.dependencies)
      ? (parsed.dependencies as MemberDependency[]).filter(
          (d) => memberIds.has(d.memberId) && memberIds.has(d.requiresId),
        )
      : [],
    createdNames: [],
    unmatchedNames: [],
  };
}

function importFromRosterTable(
  text: string,
  existingMembers: Member[],
): ShiftImportResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const members = existingMembers.map((m) => normalizeMember(m));
  const byName = new Map(members.map((m) => [safeName(m.name), m]));
  const assignments = emptyAssignments();
  const createdNames: string[] = [];
  let rowsFound = 0;
  /** テキスト表の「■ 1日目」などから引き継ぐ日程 */
  let currentDayLabel = "";

  for (const line of lines) {
    if (line.startsWith("【")) continue;
    if (line.startsWith("時間")) continue;

    // ■ 1日目 / 【1日目】 など
    const dayHeader = line.match(/^[■【]\s*(.+?)】?$/);
    if (dayHeader) {
      const label = safeName(dayHeader[1]).replace(/^未割当.*/, "");
      if (label && SLOTS.some((s) => s.dayLabel === label)) {
        currentDayLabel = label;
      }
      continue;
    }

    let cols: string[];
    if (line.includes("\t")) {
      cols = line.split("\t").map((c) => c.trim());
    } else if (line.includes(",")) {
      cols = parseCsvLine(line);
    } else {
      continue;
    }

    // 形式A: 日程, 開始, 終了, メンバー
    // 形式B: 時間(開始-終了), メンバー（直前の日ヘッダを使う）
    let slot = null as (typeof SLOTS)[number] | null;
    let namesCell = "";

    if (cols.length >= 4 && /^\d{1,2}:\d{2}$/.test(cols[1].replace("：", ":"))) {
      slot = findSlot(cols[0], cols[1], cols[2]);
      namesCell = cols.slice(3).join("、");
    } else if (cols.length >= 2) {
      const time = cols[0].replace("：", ":");
      const m = time.match(/^(\d{1,2}:\d{2})\s*[-–—〜~]\s*(\d{1,2}:\d{2})$/);
      if (m) {
        slot = findSlot(currentDayLabel, m[1], m[2]);
        namesCell = cols.slice(1).join("、");
      }
    }

    if (!slot) continue;
    rowsFound++;
    const ids: string[] = [];
    for (const name of splitNames(namesCell)) {
      const member = ensureMember(name, byName, members, createdNames);
      if (member && !ids.includes(member.id)) ids.push(member.id);
    }
    assignments[slot.id as SlotId] = ids;
  }

  if (rowsFound === 0) {
    throw new Error("シフト表の行が見つかりませんでした（CSV/TSVか編集用JSONを選んでください）");
  }

  return {
    members,
    assignments,
    warnings: [],
    lastAssignedAt: new Date().toISOString(),
    coreMemberIds: [],
    dependencies: [],
    createdNames,
    unmatchedNames: [],
  };
}

export function buildShiftBackup(input: {
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  dependencies: MemberDependency[];
}): ShiftBackup {
  return {
    kind: SHIFT_BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    members: input.members,
    assignments: input.assignments,
    warnings: input.warnings,
    lastAssignedAt: input.lastAssignedAt,
    coreMemberIds: input.coreMemberIds,
    dependencies: input.dependencies,
  };
}

/**
 * 編集用 JSON / CSV / TSV / テキスト表を読み込み、再編集可能な状態に復元する。
 */
export function parseShiftImport(
  raw: string,
  existingMembers: Member[],
): ShiftImportResult {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("ファイルが空です");

  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // API snapshot 形も許容
    const body =
      parsed.kind === SHIFT_BACKUP_KIND || Array.isArray(parsed.members)
        ? parsed
        : parsed.snapshot && typeof parsed.snapshot === "object"
          ? (parsed.snapshot as Record<string, unknown>)
          : null;
    if (!body || !Array.isArray(body.members)) {
      throw new Error("対応していないJSONです");
    }
    return importFromBackupJson(body, existingMembers);
  }

  return importFromRosterTable(text, existingMembers);
}
