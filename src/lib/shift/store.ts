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

const DATA_DIR = path.join(process.cwd(), ".data", "shift");

type StoreBundle = {
  board: ShiftBoard;
  responses: ShiftResponse[];
};

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
  await fs.writeFile(filePath(bundle.board.code), JSON.stringify(bundle, null, 2), "utf8");
}

function supabaseEnabled(): boolean {
  return Boolean(getSupabaseAdmin());
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
      const admin = getSupabaseAdmin()!;
      const { data } = await admin.from("festival_shift_boards").select("code").eq("code", code).maybeSingle();
      if (!data) return code;
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

  if (supabaseEnabled()) {
    const admin = getSupabaseAdmin()!;
    const { error } = await admin.from("festival_shift_boards").insert({
      id: board.id,
      code: board.code,
      admin_key: board.adminKey,
      title: board.title,
      note: board.note,
      days: board.days,
      slots: board.slots,
      roles: board.roles,
      assignments: null,
      created_at: board.createdAt,
      updated_at: board.updatedAt,
    });
    if (error) throw new Error(error.message);
    return board;
  }

  await writeFileBundle({ board, responses: [] });
  return board;
}

function rowToBoard(row: Record<string, unknown>): ShiftBoard {
  return {
    id: String(row.id),
    code: String(row.code),
    adminKey: String(row.admin_key),
    title: String(row.title ?? ""),
    note: String(row.note ?? ""),
    days: (row.days as ShiftDay[]) ?? [],
    slots: (row.slots as ShiftSlot[]) ?? [],
    roles: (row.roles as ShiftRole[]) ?? [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    assignments: (row.assignments as ShiftAssignmentResult | null) ?? null,
  };
}

function rowToResponse(row: Record<string, unknown>): ShiftResponse {
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    name: String(row.name ?? ""),
    prefs: (row.prefs as Record<string, Pref>) ?? {},
    preferredRoleIds: (row.preferred_role_ids as string[]) ?? [],
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getBundle(code: string): Promise<StoreBundle | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  if (supabaseEnabled()) {
    const admin = getSupabaseAdmin()!;
    const { data: boardRow, error } = await admin
      .from("festival_shift_boards")
      .select("*")
      .eq("code", normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!boardRow) return null;
    const board = rowToBoard(boardRow as Record<string, unknown>);
    const { data: responseRows, error: rErr } = await admin
      .from("festival_shift_responses")
      .select("*")
      .eq("board_id", board.id)
      .order("created_at", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    return {
      board,
      responses: (responseRows ?? []).map((r) => rowToResponse(r as Record<string, unknown>)),
    };
  }

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

  if (supabaseEnabled()) {
    const admin = getSupabaseAdmin()!;
    const { error } = await admin.from("festival_shift_responses").upsert(
      {
        id: response.id,
        board_id: response.boardId,
        name: response.name,
        prefs: response.prefs,
        preferred_role_ids: response.preferredRoleIds,
        note: response.note,
        created_at: response.createdAt,
        updated_at: response.updatedAt,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    await admin
      .from("festival_shift_boards")
      .update({ updated_at: now, assignments: null })
      .eq("id", bundle.board.id);
    return response;
  }

  const nextResponses = existing
    ? bundle.responses.map((r) => (r.id === response.id ? response : r))
    : [...bundle.responses, response];
  const nextBoard = { ...bundle.board, updatedAt: now, assignments: null };
  await writeFileBundle({ board: nextBoard, responses: nextResponses });
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

  if (supabaseEnabled()) {
    const admin = getSupabaseAdmin()!;
    const { error } = await admin
      .from("festival_shift_boards")
      .update({ assignments, updated_at: now })
      .eq("id", bundle.board.id);
    if (error) throw new Error(error.message);
    return nextBoard;
  }

  await writeFileBundle({ board: nextBoard, responses: bundle.responses });
  return nextBoard;
}

export function assertAdmin(board: ShiftBoard, adminKey: string | null | undefined): void {
  if (!adminKey || adminKey !== board.adminKey) {
    throw new Error("FORBIDDEN");
  }
}
