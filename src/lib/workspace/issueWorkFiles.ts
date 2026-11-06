import {
  createEmptyBoard,
  parseWorkspaceBoard,
  type IssueWorkspaceBoard,
} from "@/lib/workspace/issueWorkspaceBoard";

export type IssueWorkFileKind = "doc" | "board" | "canvas" | "photo" | "link";

export type IssueWorkFile = {
  id: string;
  kind: IssueWorkFileKind;
  title: string;
  /** doc → project_documents.id / board → project_boards.id / canvas・photo・link → ローカル id */
  refId: string;
  updatedAt: string;
  /** canvas のみ。作業スペースのボード本体 */
  canvasBoard?: IssueWorkspaceBoard;
  /** photo / link の実体 URL */
  url?: string;
};

function isKind(value: unknown): value is IssueWorkFileKind {
  return value === "doc" || value === "board" || value === "canvas" || value === "photo" || value === "link";
}

function normalizeUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  return value.slice(0, 2000);
}

export function createWorkFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `wf_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseIssueWorkFiles(raw: unknown): IssueWorkFile[] {
  if (!Array.isArray(raw)) return [];
  const out: IssueWorkFile[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const refId = typeof o.refId === "string" ? o.refId.trim() : "";
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
    if (!id || !refId || !isKind(o.kind) || seen.has(id)) continue;
    const url = normalizeUrl(o.url);
    if ((o.kind === "photo" || o.kind === "link") && !url) continue;
    seen.add(id);
    const canvasBoard = o.kind === "canvas" ? parseWorkspaceBoard(o.canvasBoard) ?? undefined : undefined;
    out.push({
      id,
      kind: o.kind,
      title: title || defaultTitle(o.kind),
      refId,
      updatedAt: updatedAt || new Date().toISOString(),
      canvasBoard,
      url,
    });
    if (out.length >= 40) break;
  }
  return out;
}

export function defaultTitle(kind: IssueWorkFileKind): string {
  if (kind === "doc") return "無題のドキュメント";
  if (kind === "board") return "無題のボード";
  if (kind === "photo") return "写真";
  if (kind === "link") return "リンク";
  return "作業スペース";
}

export function serializeIssueWorkFiles(files: IssueWorkFile[]): IssueWorkFile[] {
  return files.map((file) => ({
    id: file.id,
    kind: file.kind,
    title: file.title.trim() || defaultTitle(file.kind),
    refId: file.refId,
    updatedAt: file.updatedAt,
    ...(file.kind === "canvas" && file.canvasBoard ? { canvasBoard: file.canvasBoard } : {}),
    ...(file.url ? { url: file.url } : {}),
  }));
}

/** 旧・単一 workspaceBoard を作業スペースファイル1件として起こす */
export function ensureLegacyCanvasFile(
  files: IssueWorkFile[],
  board: IssueWorkspaceBoard | null | undefined,
): IssueWorkFile[] {
  if (files.some((file) => file.kind === "canvas")) return files;
  if (!board) return files;
  const now = new Date().toISOString();
  return [
    {
      id: createWorkFileId(),
      kind: "canvas",
      title: defaultTitle("canvas"),
      refId: createWorkFileId(),
      updatedAt: now,
      canvasBoard: board,
    },
    ...files,
  ];
}

export function newCanvasWorkFile(title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  return {
    id: createWorkFileId(),
    kind: "canvas",
    title: title?.trim() || defaultTitle("canvas"),
    refId: createWorkFileId(),
    updatedAt: now,
    canvasBoard: createEmptyBoard(),
  };
}

export function newPhotoWorkFile(url: string, title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  return {
    id: createWorkFileId(),
    kind: "photo",
    title: title?.trim() || defaultTitle("photo"),
    refId: createWorkFileId(),
    updatedAt: now,
    url,
  };
}

export function newLinkWorkFile(url: string, title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  let fallback = defaultTitle("link");
  try {
    fallback = new URL(url).hostname || fallback;
  } catch {
    /* keep default */
  }
  return {
    id: createWorkFileId(),
    kind: "link",
    title: title?.trim() || fallback,
    refId: createWorkFileId(),
    updatedAt: now,
    url,
  };
}

export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function upsertWorkFile(files: IssueWorkFile[], next: IssueWorkFile): IssueWorkFile[] {
  const idx = files.findIndex((file) => file.id === next.id);
  if (idx < 0) return [next, ...files];
  const copy = [...files];
  copy[idx] = next;
  return copy;
}

export function removeWorkFile(files: IssueWorkFile[], id: string): IssueWorkFile[] {
  return files.filter((file) => file.id !== id);
}

export function sortWorkFilesByUpdated(files: IssueWorkFile[]): IssueWorkFile[] {
  return [...files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
