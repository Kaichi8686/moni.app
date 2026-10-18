import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { makeAdminKey, makeId, makeShareCode } from "@/lib/shift/codes";
import { generateSlotsFromSchedule } from "@/lib/shift/slots";
import type {
  CreateBoardInput,
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftDay,
  ShiftResponse,
  ShiftRole,
  ShiftScheduleConfig,
  ShiftSlot,
  UpdateBoardInput,
} from "@/lib/shift/types";
import { DEFAULT_SCHEDULE, normalizeBoard } from "@/lib/shift/types";

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "shift-data")
    : path.join(process.cwd(), ".data", "shift");
const BUCKET = "festival-shift";

type StoreBundle = {
  board: ShiftBoard;
  responses: ShiftResponse[];
};

let bucketReady: Promise<void> | null = null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(code: string): string {
  return path.join(DATA_DIR, `${code}.json`);
}

async function readFileBundle(code: string): Promise<StoreBundle | null> {
  try {
    const raw = await fs.readFile(filePath(code), "utf8");
    return hydrateBundle(JSON.parse(raw) as StoreBundle);
  } catch {
    return null;
  }
}

async function writeFileBundle(bundle: StoreBundle): Promise<void> {
  await ensureDir();
  await fs.writeFile(filePath(bundle.board.code), JSON.stringify(bundle), "utf8");
}

function supabaseEnabled(): boolean {
  return Boolean(getSupabaseAdmin());
}

async function ensureBucket(): Promise<void> {
  if (!supabaseEnabled()) return;
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = getSupabaseAdmin()!;
      const { data, error } = await admin.storage.listBuckets();
      if (error) throw new Error(error.message);
      if (!data?.some((b) => b.name === BUCKET)) {
        const { error: createErr } = await admin.storage.createBucket(BUCKET, {
          public: false,
          fileSizeLimit: 2 * 1024 * 1024,
        });
        if (createErr && !/already exists|duplicate/i.test(createErr.message)) {
          throw new Error(createErr.message);
        }
      }
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  await bucketReady;
}

function objectPath(code: string): string {
  return `boards/${code}.json`;
}

function hydrateBundle(bundle: StoreBundle): StoreBundle {
  return {
    board: normalizeBoard(bundle.board),
    responses: bundle.responses ?? [],
  };
}

async function readRemoteBundle(code: string): Promise<StoreBundle | null> {
  await ensureBucket();
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin.storage.from(BUCKET).download(objectPath(code));
  if (error || !data) return null;
  const text = await data.text();
  return hydrateBundle(JSON.parse(text) as StoreBundle);
}

async function writeRemoteBundle(bundle: StoreBundle): Promise<void> {
  await ensureBucket();
  const admin = getSupabaseAdmin()!;
  const body = JSON.stringify(bundle);
  const { error } = await admin.storage.from(BUCKET).upload(objectPath(bundle.board.code), body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

function normalizeDays(input: CreateBoardInput["days"]): ShiftDay[] {
  return input.map((d, i) => ({
    id: `d${i + 1}`,
    label: d.label.trim() || `日程${i + 1}`,
    date: (d.date ?? "").trim(),
  }));
}

function normalizeRoles(input: NonNullable<UpdateBoardInput["roles"]>): ShiftRole[] {
  return input.map((r, i) => ({
    id: `r${i + 1}`,
    name: r.name.trim() || `役割${i + 1}`,
    needed: Math.max(1, Math.min(50, Math.floor(r.needed || 1))),
  }));
}

function normalizeSchedule(input?: ShiftScheduleConfig): ShiftScheduleConfig {
  const base = input ?? DEFAULT_SCHEDULE;
  return {
    dayStart: base.dayStart || DEFAULT_SCHEDULE.dayStart,
    dayEnd: base.dayEnd || DEFAULT_SCHEDULE.dayEnd,
    slotMinutes: Math.max(5, Math.min(480, Math.floor(base.slotMinutes || 60))),
    breaks: (base.breaks ?? []).map((b, i) => ({
      id: b.id || `br${i + 1}`,
      label: (b.label || "休み時間").trim(),
      start: b.start,
      end: b.end,
    })),
    maxConsecutive: Math.max(0, Math.min(20, Math.floor(base.maxConsecutive || 0))),
    buddyPairs: (base.buddyPairs ?? []).map((p, i) => ({
      id: p.id || `bp${i + 1}`,
      nameA: p.nameA.trim(),
      nameB: p.nameB.trim(),
    })),
  };
}

function slotsFromInput(input: CreateBoardInput): ShiftSlot[] {
  if (input.slots && input.slots.length > 0) {
    return input.slots.map((s, i) => ({
      id: s.isBreak ? `b${i + 1}` : `s${i + 1}`,
      label: s.label.trim() || `時間帯${i + 1}`,
      start: s.start?.trim() || undefined,
      end: s.end?.trim() || undefined,
      isBreak: Boolean(s.isBreak),
    }));
  }
  return generateSlotsFromSchedule(normalizeSchedule(input.schedule));
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = makeShareCode(8);
    const existing = supabaseEnabled()
      ? await readRemoteBundle(code)
      : await readFileBundle(code);
    if (!existing) return code;
  }
  return makeShareCode(10);
}

async function persist(bundle: StoreBundle): Promise<void> {
  if (supabaseEnabled()) await writeRemoteBundle(bundle);
  else await writeFileBundle(bundle);
}

function normalizeMemberNames(input?: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of input ?? []) {
    const name = raw.trim().slice(0, 40);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= 80) break;
  }
  return names;
}

function responsesFromMembers(
  boardId: string,
  names: string[],
  now: string,
): ShiftResponse[] {
  return names.map((name) => ({
    id: makeId(),
    boardId,
    name,
    prefs: {},
    preferredRoleIds: [],
    note: "",
    createdAt: now,
    updatedAt: now,
  }));
}

export async function createBoard(input: CreateBoardInput): Promise<ShiftBoard> {
  const now = new Date().toISOString();
  const schedule = normalizeSchedule(input.schedule);
  const board: ShiftBoard = {
    id: makeId(),
    code: await uniqueCode(),
    adminKey: makeAdminKey(),
    title: input.title.trim() || "文化祭シフト",
    note: (input.note ?? "").trim(),
    days: normalizeDays(input.days),
    slots: slotsFromInput({ ...input, schedule }),
    roles: normalizeRoles(input.roles),
    schedule,
    createdAt: now,
    updatedAt: now,
    assignments: null,
  };

  const members = normalizeMemberNames(input.members);
  const responses = responsesFromMembers(board.id, members, now);
  await persist({ board, responses });
  return board;
}

export async function getBundle(code: string): Promise<StoreBundle | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  if (supabaseEnabled()) return readRemoteBundle(normalized);
  return readFileBundle(normalized);
}

export async function updateBoard(
  code: string,
  adminKey: string,
  input: UpdateBoardInput,
): Promise<ShiftBoard> {
  const bundle = await getBundle(code);
  if (!bundle) throw new Error("NOT_FOUND");
  if (bundle.board.adminKey !== adminKey) throw new Error("FORBIDDEN");

  const now = new Date().toISOString();
  const next: ShiftBoard = { ...bundle.board, updatedAt: now, assignments: null };

  if (input.title !== undefined) next.title = input.title.trim() || next.title;
  if (input.note !== undefined) next.note = input.note.trim();
  if (input.days) next.days = normalizeDays(input.days);
  if (input.roles) next.roles = normalizeRoles(input.roles);
  if (input.schedule) {
    next.schedule = normalizeSchedule(input.schedule);
    next.slots = generateSlotsFromSchedule(next.schedule);
  }

  let responses = bundle.responses;
  if (input.members) {
    const names = normalizeMemberNames(input.members);
    const byName = new Map(bundle.responses.map((r) => [r.name, r]));
    responses = names.map((name) => {
      const existing = byName.get(name);
      if (existing) return existing;
      return {
        id: makeId(),
        boardId: next.id,
        name,
        prefs: {},
        preferredRoleIds: [],
        note: "",
        createdAt: now,
        updatedAt: now,
      };
    });
    next.assignments = null;
  }

  await persist({ board: next, responses });
  return next;
}

export async function upsertResponse(
  code: string,
  input: {
    name: string;
    prefs: Record<string, Pref>;
    preferredRoleIds: string[];
    note?: string;
    responseId?: string;
  },
): Promise<ShiftResponse> {
  const bundle = await getBundle(code);
  if (!bundle) throw new Error("NOT_FOUND");

  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error("NAME_REQUIRED");

  const now = new Date().toISOString();
  const existing =
    (input.responseId
      ? bundle.responses.find((r) => r.id === input.responseId)
      : null) ??
    bundle.responses.find((r) => r.name === name);

  const response: ShiftResponse = existing
    ? {
        ...existing,
        name,
        prefs: input.prefs,
        preferredRoleIds: input.preferredRoleIds,
        note: (input.note ?? "").trim().slice(0, 200),
        updatedAt: now,
      }
    : {
        id: makeId(),
        boardId: bundle.board.id,
        name,
        prefs: input.prefs,
        preferredRoleIds: input.preferredRoleIds,
        note: (input.note ?? "").trim().slice(0, 200),
        createdAt: now,
        updatedAt: now,
      };

  const nextResponses = existing
    ? bundle.responses.map((r) => (r.id === response.id ? response : r))
    : [...bundle.responses, response];
  await persist({
    board: { ...bundle.board, updatedAt: now, assignments: null },
    responses: nextResponses,
  });
  return response;
}

export async function saveAssignments(
  code: string,
  adminKey: string,
  assignments: ShiftAssignmentResult,
): Promise<ShiftBoard> {
  const bundle = await getBundle(code);
  if (!bundle) throw new Error("NOT_FOUND");
  if (bundle.board.adminKey !== adminKey) throw new Error("FORBIDDEN");

  const now = new Date().toISOString();
  const nextBoard = { ...bundle.board, assignments, updatedAt: now };
  await persist({ board: nextBoard, responses: bundle.responses });
  return nextBoard;
}

export function assertAdmin(board: ShiftBoard, adminKey: string | null | undefined): void {
  if (!adminKey || adminKey !== board.adminKey) {
    throw new Error("FORBIDDEN");
  }
}
