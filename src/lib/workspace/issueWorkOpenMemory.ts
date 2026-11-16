/** 課題の作業ファイル（ドキュメント／作業スペース等）を開いたまま覚えておく */

export type IssueWorkOpenMemory = {
  fileId: string;
  updatedAt: number;
};

function storageKey(projectId: string, issueId: string): string {
  return `moni:issueWorkOpen:v1:${projectId}:${issueId}`;
}

export function readIssueWorkOpen(
  projectId: string,
  issueId: string,
): IssueWorkOpenMemory | null {
  if (typeof window === "undefined" || !projectId || !issueId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId, issueId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IssueWorkOpenMemory>;
    const fileId = typeof parsed.fileId === "string" ? parsed.fileId.trim() : "";
    if (!fileId) return null;
    return {
      fileId,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeIssueWorkOpen(projectId: string, issueId: string, fileId: string) {
  if (typeof window === "undefined" || !projectId || !issueId || !fileId) return;
  try {
    const payload: IssueWorkOpenMemory = { fileId, updatedAt: Date.now() };
    window.sessionStorage.setItem(storageKey(projectId, issueId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearIssueWorkOpen(projectId: string, issueId: string) {
  if (typeof window === "undefined" || !projectId || !issueId) return;
  try {
    window.sessionStorage.removeItem(storageKey(projectId, issueId));
  } catch {
    /* ignore */
  }
}
