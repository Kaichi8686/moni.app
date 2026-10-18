import { promises as fs } from "fs";
import path from "path";
import { emptyAssignments } from "./schedule";
import type { AssignWarning, Assignments, Member, MemberPair } from "./types";

export type BunkasaiSnapshot = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  pairs: MemberPair[];
  updatedAt: string;
};

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "bunkasai-shift-data")
    : path.join(process.cwd(), ".data", "bunkasai-shift");

const DEFAULT_ROOM = "main";

function sanitizeRoom(room: string | null | undefined): string {
  const raw = (room ?? DEFAULT_ROOM).trim().toLowerCase() || DEFAULT_ROOM;
  const cleaned = raw.replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return cleaned || DEFAULT_ROOM;
}

function filePath(room: string): string {
  return path.join(DATA_DIR, `${room}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function emptySnapshot(room: string): BunkasaiSnapshot {
  return {
    room,
    members: [],
    assignments: emptyAssignments(),
    warnings: [],
    lastAssignedAt: null,
    coreMemberIds: [],
    pairs: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizePairs(raw: unknown, memberIds: Set<string>): MemberPair[] {
  if (!Array.isArray(raw)) return [];
  const out: MemberPair[] = [];
  const used = new Set<string>();
  for (const item of raw) {
    const p = item as Partial<MemberPair>;
    const ids = Array.isArray(p.memberIds) ? p.memberIds.map(String) : [];
    if (ids.length !== 2) continue;
    const [a, b] = ids;
    if (!memberIds.has(a) || !memberIds.has(b) || a === b) continue;
    if (used.has(a) || used.has(b)) continue;
    used.add(a);
    used.add(b);
    out.push({
      id: String(p.id || `pair-${a}-${b}`),
      memberIds: [a, b],
    });
  }
  return out.slice(0, 40);
}

export async function loadSnapshot(roomInput?: string | null): Promise<BunkasaiSnapshot> {
  const room = sanitizeRoom(roomInput);
  try {
    const raw = await fs.readFile(filePath(room), "utf8");
    const parsed = JSON.parse(raw) as Partial<BunkasaiSnapshot>;
    const members = Array.isArray(parsed.members) ? parsed.members : [];
    const memberIds = new Set(members.map((m) => m.id));
    return {
      room,
      members,
      assignments: parsed.assignments ?? emptyAssignments(),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      lastAssignedAt: parsed.lastAssignedAt ?? null,
      coreMemberIds: Array.isArray(parsed.coreMemberIds)
        ? parsed.coreMemberIds.map(String).filter((id) => memberIds.has(id))
        : [],
      pairs: normalizePairs(parsed.pairs, memberIds),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptySnapshot(room);
  }
}

export async function saveSnapshot(
  input: Omit<BunkasaiSnapshot, "room" | "updatedAt"> & { room?: string | null },
): Promise<BunkasaiSnapshot> {
  const room = sanitizeRoom(input.room);
  if (!Array.isArray(input.members)) {
    throw new Error("MEMBERS_REQUIRED");
  }
  if (input.members.length > 200) {
    throw new Error("MEMBERS_TOO_MANY");
  }

  const members = input.members.map((m) => ({
    id: String(m.id),
    name: String(m.name ?? "").trim().slice(0, 40),
    ngSlotIds: Array.isArray(m.ngSlotIds) ? m.ngSlotIds : [],
  }));
  const memberIds = new Set(members.map((m) => m.id));

  const snapshot: BunkasaiSnapshot = {
    room,
    members,
    assignments: input.assignments ?? emptyAssignments(),
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    lastAssignedAt: input.lastAssignedAt ?? null,
    coreMemberIds: Array.isArray(input.coreMemberIds)
      ? input.coreMemberIds.map(String).filter((id) => memberIds.has(id)).slice(0, 80)
      : [],
    pairs: normalizePairs(input.pairs, memberIds),
    updatedAt: new Date().toISOString(),
  };

  await ensureDir();
  const target = filePath(room);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await fs.rename(tmp, target);
  return snapshot;
}

export { DEFAULT_ROOM, sanitizeRoom };
