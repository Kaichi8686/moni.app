import { promises as fs } from "fs";
import path from "path";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { emptyAssignments } from "./schedule";
import seedMain from "./seed-main.json";
import type {
  AssignWarning,
  Assignments,
  Member,
  MemberDependency,
  MemberPair,
} from "./types";
import { normalizeMember } from "./types";

export type BunkasaiSnapshot = {
  room: string;
  members: Member[];
  assignments: Assignments;
  warnings: AssignWarning[];
  lastAssignedAt: string | null;
  coreMemberIds: string[];
  dependencies: MemberDependency[];
  updatedAt: string;
};

const DATA_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "bunkasai-shift-data")
    : path.join(process.cwd(), ".data", "bunkasai-shift");

/** festival-shift バケット内。既存の shift ボードと同居 */
const BUCKET = "festival-shift";
const OBJECT_PREFIX = "bunkasai-rooms";

const DEFAULT_ROOM = "main";

let bucketReady: Promise<void> | null = null;

function sanitizeRoom(room: string | null | undefined): string {
  const raw = (room ?? DEFAULT_ROOM).trim().toLowerCase() || DEFAULT_ROOM;
  const cleaned = raw.replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return cleaned || DEFAULT_ROOM;
}

function filePath(room: string): string {
  return path.join(DATA_DIR, `${room}.json`);
}

function objectPath(room: string): string {
  return `${OBJECT_PREFIX}/${room}.json`;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
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

function emptySnapshot(room: string): BunkasaiSnapshot {
  return {
    room,
    members: [],
    assignments: emptyAssignments(),
    warnings: [],
    lastAssignedAt: null,
    coreMemberIds: [],
    dependencies: [],
    updatedAt: new Date().toISOString(),
  };
}

/** リポジトリ同梱の初期名簿。リモート/ディスクが空でも消えないようにする */
function loadBundledSeed(room: string): BunkasaiSnapshot | null {
  if (room !== DEFAULT_ROOM) return null;
  const hydrated = hydrateSnapshot(
    room,
    seedMain as Partial<BunkasaiSnapshot> & { pairs?: MemberPair[] },
  );
  if (hydrated.members.length === 0) return null;
  return hydrated;
}

function normalizeDependencies(
  rawDeps: unknown,
  rawPairs: unknown,
  memberIds: Set<string>,
): MemberDependency[] {
  const out: MemberDependency[] = [];
  const seen = new Set<string>(); // memberId that already has a requires

  if (Array.isArray(rawDeps)) {
    for (const item of rawDeps) {
      const d = item as Partial<MemberDependency>;
      const memberId = String(d.memberId ?? "");
      const requiresId = String(d.requiresId ?? "");
      if (!memberIds.has(memberId) || !memberIds.has(requiresId) || memberId === requiresId) {
        continue;
      }
      if (seen.has(memberId)) continue;
      seen.add(memberId);
      out.push({
        id: String(d.id || `dep-${memberId}-${requiresId}`),
        memberId,
        requiresId,
      });
    }
  }

  // 旧相互ペア → 「先頭が末尾を必要とする」片方向に移行
  if (out.length === 0 && Array.isArray(rawPairs)) {
    for (const item of rawPairs as MemberPair[]) {
      const ids = Array.isArray(item.memberIds) ? item.memberIds.map(String) : [];
      if (ids.length !== 2) continue;
      const [a, b] = ids;
      if (!memberIds.has(a) || !memberIds.has(b) || a === b || seen.has(a)) continue;
      seen.add(a);
      out.push({
        id: String(item.id || `dep-${a}-${b}`),
        memberId: a,
        requiresId: b,
      });
    }
  }

  return out.slice(0, 80);
}

function hydrateSnapshot(
  room: string,
  parsed: Partial<BunkasaiSnapshot> & { pairs?: MemberPair[] },
): BunkasaiSnapshot {
  const members = (Array.isArray(parsed.members) ? parsed.members : []).map((m) =>
    normalizeMember(m),
  );
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
    dependencies: normalizeDependencies(parsed.dependencies, parsed.pairs, memberIds),
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

async function readFileSnapshot(room: string): Promise<BunkasaiSnapshot | null> {
  try {
    const raw = await fs.readFile(filePath(room), "utf8");
    return hydrateSnapshot(
      room,
      JSON.parse(raw) as Partial<BunkasaiSnapshot> & { pairs?: MemberPair[] },
    );
  } catch {
    return null;
  }
}

async function writeFileSnapshot(snapshot: BunkasaiSnapshot): Promise<void> {
  await ensureDir();
  const target = filePath(snapshot.room);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot), "utf8");
  await fs.rename(tmp, target);
}

async function readRemoteSnapshot(room: string): Promise<BunkasaiSnapshot | null> {
  await ensureBucket();
  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin.storage.from(BUCKET).download(objectPath(room));
  if (error || !data) return null;
  const text = await data.text();
  return hydrateSnapshot(
    room,
    JSON.parse(text) as Partial<BunkasaiSnapshot> & { pairs?: MemberPair[] },
  );
}

async function writeRemoteSnapshot(snapshot: BunkasaiSnapshot): Promise<void> {
  await ensureBucket();
  const admin = getSupabaseAdmin()!;
  const body = JSON.stringify(snapshot);
  const { error } = await admin.storage.from(BUCKET).upload(objectPath(snapshot.room), body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}

function preferRicher(a: BunkasaiSnapshot | null, b: BunkasaiSnapshot | null): BunkasaiSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  if (a.members.length !== b.members.length) {
    return a.members.length > b.members.length ? a : b;
  }
  const aTime = Date.parse(a.updatedAt) || 0;
  const bTime = Date.parse(b.updatedAt) || 0;
  return aTime >= bTime ? a : b;
}

async function promoteIfNeeded(
  richer: BunkasaiSnapshot,
  remote: BunkasaiSnapshot | null,
): Promise<void> {
  if (remote && remote.members.length > 0) return;
  if (richer.members.length === 0) return;
  if (supabaseEnabled()) {
    try {
      await writeRemoteSnapshot(richer);
    } catch {
      /* 次回 PUT に任せる */
    }
  }
  try {
    await writeFileSnapshot(richer);
  } catch {
    /* ignore */
  }
}

export async function loadSnapshot(roomInput?: string | null): Promise<BunkasaiSnapshot> {
  const room = sanitizeRoom(roomInput);
  const fileSnap = await readFileSnapshot(room);
  const seedSnap = loadBundledSeed(room);

  if (supabaseEnabled()) {
    try {
      const remote = await readRemoteSnapshot(room);
      const best = preferRicher(preferRicher(remote, fileSnap), seedSnap);
      if (best && best.members.length > 0) {
        await promoteIfNeeded(best, remote);
        return best;
      }
    } catch {
      const fallback = preferRicher(fileSnap, seedSnap);
      if (fallback) return fallback;
      return emptySnapshot(room);
    }
  }

  const local = preferRicher(fileSnap, seedSnap);
  if (local && local.members.length > 0) {
    // ディスクが空ならシードを書き戻し、以降のプロセスでも残す
    if (!fileSnap || fileSnap.members.length === 0) {
      try {
        await writeFileSnapshot(local);
      } catch {
        /* ignore */
      }
    }
    return local;
  }

  return emptySnapshot(room);
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

  const members = input.members.map((m) => normalizeMember(m));
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
    dependencies: normalizeDependencies(input.dependencies, null, memberIds),
    updatedAt: new Date().toISOString(),
  };

  // サーバーレスの /tmp は消えるので、Supabase があるときは必ずリモートへ
  if (supabaseEnabled()) {
    await writeRemoteSnapshot(snapshot);
  }
  // ローカル開発・フォールバック用にもディスクへ（Vercel /tmp でも最新プロセス内の再読込に効く）
  try {
    await writeFileSnapshot(snapshot);
  } catch {
    if (!supabaseEnabled()) throw new Error("SAVE_FAILED");
  }

  return snapshot;
}

export { DEFAULT_ROOM, sanitizeRoom };
