import { promises as fs } from "fs";
import path from "path";
import { emptyAssignments } from "./schedule";
import type { AssignWarning, Assignments, Member } from "./types";

export type BunkasaiSnapshot = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
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
    updatedAt: new Date().toISOString(),
  };
}

export async function loadSnapshot(roomInput?: string | null): Promise<BunkasaiSnapshot> {
  const room = sanitizeRoom(roomInput);
  try {
    const raw = await fs.readFile(filePath(room), "utf8");
    const parsed = JSON.parse(raw) as Partial<BunkasaiSnapshot>;
    return {
      room,
      members: Array.isArray(parsed.members) ? parsed.members : [],
      assignments: parsed.assignments ?? emptyAssignments(),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      lastAssignedAt: parsed.lastAssignedAt ?? null,
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

  const snapshot: BunkasaiSnapshot = {
    room,
    members: input.members.map((m) => ({
      id: String(m.id),
      name: String(m.name ?? "").trim().slice(0, 40),
      ngSlotIds: Array.isArray(m.ngSlotIds) ? m.ngSlotIds : [],
    })),
    assignments: input.assignments ?? emptyAssignments(),
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    lastAssignedAt: input.lastAssignedAt ?? null,
    updatedAt: new Date().toISOString(),
  };

  await ensureDir();
  // 一時ファイル経由で壊れた書き込みを防ぐ
  const target = filePath(room);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await fs.rename(tmp, target);
  return snapshot;
}

export { DEFAULT_ROOM, sanitizeRoom };
