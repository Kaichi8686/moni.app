import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { makeAdminKey, makeId, makeShareCode } from "@/lib/shift/codes";
import type {
  CreateBoardInput,
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftDay,
  ShiftResponse,
  ShiftRole,
  ShiftSlot,
} from "@/lib/shift/types";

/** Vercel の /var/task は読み取り専用なので /tmp を使う（ローカルは .data） */
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
    return JSON.parse(raw) as StoreBundle;
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
        // race: already exists is fine
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

async function readRemoteBundle(code: string): Promise<StoreBundle | null> {
  await ensureBucket();
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin.storage.from(BUCKET).download(objectPath(code));
  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text) as StoreBundle;
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

function normalizeSlots(input: CreateBoardInput["slots"]): ShiftSlot[] {
  return input.map((s, i) => ({
    id: `s${i + 1}`,
    label: s.label.trim() || `時間帯${i + 1}`,
    start: s.start?.trim() || undefined,
    end: s.end?.trim() || undefined,
  }));
}

function normalizeRoles(input: CreateBoardInput["roles"]): ShiftRole[] {
  return input.map((r, i) => ({
    id: `r${i + 1}`,
    name: r.name.trim() || `役割${i + 1}`,
    needed: Math.max(1, Math.min(50, Math.floor(r.needed || 1))),
  }));
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = makeShareCode(8);
    if (supabaseEnabled()) {
      const existing = await readRemoteBundle(code);
      if (!existing) return code;
    } else {
      const existing = await readFileBundle(code);
      if (!existing) return code;
    }
  }
  return makeShareCode(10);
}

export async function createBoard(input: CreateBoardInput): Promise<ShiftBoard> {
  const now = new Date().toISOString();
  const board: ShiftBoard = {
    id: makeId(),
    code: await uniqueCode(),
    adminKey: makeAdminKey(),
    title: input.title.trim() || "文化祭シフト",
    note: (input.note ?? "").trim(),
    days: normalizeDays(input.days),
    slots: normalizeSlots(input.slots),
    roles: normalizeRoles(input.roles),
    createdAt: now,
    updatedAt: now,
    assignments: null,
  };

  const bundle = { board, responses: [] as ShiftResponse[] };
  if (supabaseEnabled()) {
    await writeRemoteBundle(bundle);
  } else {
    await writeFileBundle(bundle);
  }
  return board;
}

export async function getBundle(code: string): Promise<StoreBundle | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  if (supabaseEnabled()) return readRemoteBundle(normalized);
  return readFileBundle(normalized);
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
  const nextBoard = { ...bundle.board, updatedAt: now, assignments: null };
  const next = { board: nextBoard, responses: nextResponses };

  if (supabaseEnabled()) await writeRemoteBundle(next);
  else await writeFileBundle(next);

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
  const next = { board: nextBoard, responses: bundle.responses };

  if (supabaseEnabled()) await writeRemoteBundle(next);
  else await writeFileBundle(next);

  return nextBoard;
}

export function assertAdmin(board: ShiftBoard, adminKey: string | null | undefined): void {
  if (!adminKey || adminKey !== board.adminKey) {
    throw new Error("FORBIDDEN");
  }
}
