import {
  createEmptyBoard,
  parseWorkspaceBoard,
  type IssueWorkspaceBoard,
} from "@/lib/workspace/issueWorkspaceBoard";

export type IssueWorkFileKind = "doc" | "board" | "canvas" | "photo" | "link";

/** 写真・リンク依頼スロット内の1件 */
export type IssueWorkFileItem = {
  id: string;
  url: string;
  title?: string;
  addedBy?: string;
  addedAt: string;
};

export type IssueWorkFile = {
  id: string;
  kind: IssueWorkFileKind;
  title: string;
  /** doc → project_documents.id / board → project_boards.id / canvas・photo・link → ローカル id */
  refId: string;
  updatedAt: string;
  /** canvas のみ。作業スペースのボード本体 */
  canvasBoard?: IssueWorkspaceBoard;
  /** 旧・単一 photo/link URL（items が無い場合の互換） */
  url?: string;
  /** 写真・リンク依頼スロット。担当者が入れる実体 */
  items?: IssueWorkFileItem[];
  /** 提出前に完成必須 */
  required?: boolean;
  /** 必須ファイルを担当者が完了した時刻 */
  completedAt?: string | null;
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

function parseItems(raw: unknown): IssueWorkFileItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: IssueWorkFileItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const url = normalizeUrl(o.url);
    if (!id || !url) continue;
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : undefined;
    const addedBy = typeof o.addedBy === "string" ? o.addedBy : undefined;
    const addedAt = typeof o.addedAt === "string" ? o.addedAt : new Date().toISOString();
    out.push({ id, url, title, addedBy, addedAt });
    if (out.length >= 40) break;
  }
  return out;
}

export function createWorkFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `wf_${Math.random().toString(36).slice(2, 10)}`;
}

export function isCollectSlot(file: IssueWorkFile): boolean {
  return file.kind === "photo" || file.kind === "link";
}

export function fileItems(file: IssueWorkFile): IssueWorkFileItem[] {
  if (file.items && file.items.length > 0) return file.items;
  if (file.url) {
    return [
      {
        id: `${file.id}_legacy`,
        url: file.url,
        title: file.title,
        addedAt: file.updatedAt,
      },
    ];
  }
  return [];
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
    const items = parseItems(o.items);
    // photo/link は依頼スロットとして url/items なしでも可
    seen.add(id);
    const canvasBoard = o.kind === "canvas" ? parseWorkspaceBoard(o.canvasBoard) ?? undefined : undefined;
    const required = o.required === true;
    const completedAt =
      typeof o.completedAt === "string" && o.completedAt.trim()
        ? o.completedAt
        : o.completedAt === null
          ? null
          : undefined;
    out.push({
      id,
      kind: o.kind,
      title: title || defaultTitle(o.kind),
      refId,
      updatedAt: updatedAt || new Date().toISOString(),
      canvasBoard,
      url,
      items,
      required: required || undefined,
      completedAt: completedAt === undefined ? undefined : completedAt,
    });
    if (out.length >= 40) break;
  }
  return out;
}

export function defaultTitle(kind: IssueWorkFileKind): string {
  if (kind === "doc") return "無題のドキュメント";
  if (kind === "board") return "無題のボード";
  if (kind === "photo") return "写真を送る";
  if (kind === "link") return "リンクを送る";
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
    ...(file.items && file.items.length > 0 ? { items: file.items } : {}),
    ...(file.required ? { required: true } : {}),
    ...(file.completedAt ? { completedAt: file.completedAt } : file.completedAt === null ? { completedAt: null } : {}),
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

/** 担当者が写真を入れる依頼スロット */
export function newPhotoSlotFile(title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  return {
    id: createWorkFileId(),
    kind: "photo",
    title: title?.trim() || defaultTitle("photo"),
    refId: createWorkFileId(),
    updatedAt: now,
    items: [],
  };
}

/** 担当者がリンクを入れる依頼スロット */
export function newLinkSlotFile(title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  return {
    id: createWorkFileId(),
    kind: "link",
    title: title?.trim() || defaultTitle("link"),
    refId: createWorkFileId(),
    updatedAt: now,
    items: [],
  };
}

/** @deprecated 単体写真。新規は newPhotoSlotFile + items を使う */
export function newPhotoWorkFile(url: string, title?: string): IssueWorkFile {
  const now = new Date().toISOString();
  return {
    id: createWorkFileId(),
    kind: "photo",
    title: title?.trim() || defaultTitle("photo"),
    refId: createWorkFileId(),
    updatedAt: now,
    url,
    items: [{ id: createWorkFileId(), url, addedAt: now }],
  };
}

/** @deprecated 単体リンク。新規は newLinkSlotFile + items を使う */
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
    items: [{ id: createWorkFileId(), url, title: title?.trim() || fallback, addedAt: now }],
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

export function setWorkFileRequired(file: IssueWorkFile, required: boolean): IssueWorkFile {
  return {
    ...file,
    required: required || undefined,
    completedAt: required ? file.completedAt ?? null : undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function markWorkFileComplete(file: IssueWorkFile, done: boolean): IssueWorkFile {
  return {
    ...file,
    completedAt: done ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
}

export function requiredFilesReady(files: IssueWorkFile[]): boolean {
  const required = files.filter((file) => file.required);
  if (required.length === 0) return true;
  return required.every((file) => Boolean(file.completedAt));
}

export function appendFileItem(
  file: IssueWorkFile,
  item: Omit<IssueWorkFileItem, "id" | "addedAt"> & { id?: string; addedAt?: string },
): IssueWorkFile {
  const nextItem: IssueWorkFileItem = {
    id: item.id ?? createWorkFileId(),
    url: item.url,
    title: item.title,
    addedBy: item.addedBy,
    addedAt: item.addedAt ?? new Date().toISOString(),
  };
  const items = [...fileItems(file), nextItem];
  return {
    ...file,
    items,
    url: file.url ?? items[0]?.url,
    updatedAt: new Date().toISOString(),
  };
}
