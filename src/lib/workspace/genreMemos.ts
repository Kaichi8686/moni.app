import { parseIssueWorkFiles, serializeIssueWorkFiles, type IssueWorkFile } from "@/lib/workspace/issueWorkFiles";

export type GenreMemoEntry = {
  workFiles: IssueWorkFile[];
  updatedAt: string;
};

/** coaching_context.genreMemos のキー（ステップ単位） */
export function stepMemoKey(phaseId: string | null | undefined): string {
  return phaseId ?? "none";
}

/** @deprecated 旧ジャンル単位キー。読み取り互換用 */
export function genreMemoKey(phaseId: string | null | undefined, genre: string): string {
  return `${phaseId ?? "none"}::${genre}`;
}

export function parseGenreMemos(raw: unknown): Record<string, GenreMemoEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, GenreMemoEntry> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim()) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const o = value as Record<string, unknown>;
    const workFiles = parseIssueWorkFiles(o.workFiles);
    const updatedAt =
      typeof o.updatedAt === "string" && o.updatedAt.trim()
        ? o.updatedAt
        : new Date().toISOString();
    out[key] = { workFiles, updatedAt };
    if (Object.keys(out).length >= 80) break;
  }
  return out;
}

export function serializeGenreMemos(
  memos: Record<string, GenreMemoEntry>,
): Record<string, GenreMemoEntry> {
  const out: Record<string, GenreMemoEntry> = {};
  for (const [key, entry] of Object.entries(memos)) {
    out[key] = {
      workFiles: serializeIssueWorkFiles(entry.workFiles ?? []),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
  }
  return out;
}

export function getStepMemoFiles(
  memos: Record<string, GenreMemoEntry> | undefined,
  phaseId: string | null | undefined,
): IssueWorkFile[] {
  if (!memos) return [];
  return memos[stepMemoKey(phaseId)]?.workFiles ?? [];
}

export function upsertStepMemoFiles(
  memos: Record<string, GenreMemoEntry> | undefined,
  phaseId: string | null | undefined,
  workFiles: IssueWorkFile[],
): Record<string, GenreMemoEntry> {
  const next = { ...(memos ?? {}) };
  const key = stepMemoKey(phaseId);
  const serialized = serializeIssueWorkFiles(workFiles);
  if (serialized.length === 0) {
    delete next[key];
    return next;
  }
  next[key] = {
    workFiles: serialized,
    updatedAt: new Date().toISOString(),
  };
  return next;
}
