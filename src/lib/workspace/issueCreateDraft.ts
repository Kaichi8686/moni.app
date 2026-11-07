import { parseIssueWorkFiles, type IssueWorkFile } from "@/lib/workspace/issueWorkFiles";

export type IssueCreateDraft = {
  step: "details" | "files";
  title: string;
  description: string;
  assignees: string[];
  dueDate: string;
  beginAt: string;
  files: IssueWorkFile[];
  updatedAt: number;
};

function storageKey(projectId: string, phaseId: string | null, genre: string): string {
  return `moni:issueCreateDraft:v1:${projectId}:${phaseId ?? "none"}:${genre}`;
}

export function readIssueCreateDraft(
  projectId: string,
  phaseId: string | null,
  genre: string,
): IssueCreateDraft | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId, phaseId, genre));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IssueCreateDraft>;
    if (parsed.step !== "details" && parsed.step !== "files") return null;
    return {
      step: parsed.step,
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      assignees: Array.isArray(parsed.assignees)
        ? parsed.assignees.filter((id): id is string => typeof id === "string")
        : [],
      dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : "",
      beginAt: typeof parsed.beginAt === "string" ? parsed.beginAt : "",
      files: parseIssueWorkFiles(parsed.files),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeIssueCreateDraft(
  projectId: string,
  phaseId: string | null,
  genre: string,
  draft: Omit<IssueCreateDraft, "updatedAt">,
) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const payload: IssueCreateDraft = { ...draft, updatedAt: Date.now() };
    window.sessionStorage.setItem(storageKey(projectId, phaseId, genre), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearIssueCreateDraft(projectId: string, phaseId: string | null, genre: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.removeItem(storageKey(projectId, phaseId, genre));
  } catch {
    /* ignore */
  }
}

function openSessionKey(projectId: string): string {
  return `moni:issueCreateOpen:v1:${projectId}`;
}

/** 課題作成ウィザードを開いていることを覚える（他タブへ行っても再開するため） */
export function markIssueCreateOpen(projectId: string, phaseId: string | null, genre: string) {
  if (typeof window === "undefined" || !projectId || !genre) return;
  try {
    window.sessionStorage.setItem(
      openSessionKey(projectId),
      JSON.stringify({ phaseId, genre, openedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function clearIssueCreateOpen(projectId: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.removeItem(openSessionKey(projectId));
  } catch {
    /* ignore */
  }
}

export function readIssueCreateOpen(
  projectId: string,
): { phaseId: string | null; genre: string } | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(openSessionKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { phaseId?: unknown; genre?: unknown };
    const genre = typeof parsed.genre === "string" ? parsed.genre : "";
    if (!genre) return null;
    const phaseId =
      parsed.phaseId === null
        ? null
        : typeof parsed.phaseId === "string"
          ? parsed.phaseId
          : null;
    return { phaseId, genre };
  } catch {
    return null;
  }
}

/** 公開時: 必須を先に、作成順は維持 */
export function orderFilesForPublish(files: IssueWorkFile[]): IssueWorkFile[] {
  const required = files.filter((file) => file.required);
  const optional = files.filter((file) => !file.required);
  return [...required, ...optional];
}

/** 配列内の位置を保ったまま更新（無ければ末尾に追加） */
export function replaceWorkFileInPlace(files: IssueWorkFile[], next: IssueWorkFile): IssueWorkFile[] {
  const idx = files.findIndex((file) => file.id === next.id);
  if (idx < 0) return [...files, next];
  const copy = [...files];
  copy[idx] = next;
  return copy;
}
