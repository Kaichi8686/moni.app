/** 概要のゴール初回入力中ドラフト（他タブ・他サイトへ行っても残す） */

export type ProjectBriefDraft = {
  v: 1;
  open: boolean;
  problemMotivation: string;
  projectGoal: string;
  updatedAt: string;
};

function storageKey(projectId: string): string {
  return `moni:projectBriefDraft:${projectId}`;
}

function writeBoth(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeBoth(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readRaw(key: string): string | null {
  try {
    const fromLocal = window.localStorage.getItem(key);
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sanitize(raw: unknown): ProjectBriefDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.v !== 1) return null;
  return {
    v: 1,
    open: Boolean(d.open),
    problemMotivation: typeof d.problemMotivation === "string" ? d.problemMotivation : "",
    projectGoal: typeof d.projectGoal === "string" ? d.projectGoal : "",
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
  };
}

export function readProjectBriefDraft(projectId: string): ProjectBriefDraft | null {
  if (typeof window === "undefined" || !projectId) return null;
  const raw = readRaw(storageKey(projectId));
  if (!raw) return null;
  try {
    return sanitize(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeProjectBriefDraft(
  projectId: string,
  draft: Omit<ProjectBriefDraft, "v" | "updatedAt"> & { updatedAt?: string },
): void {
  if (typeof window === "undefined" || !projectId) return;
  const next: ProjectBriefDraft = {
    v: 1,
    open: draft.open,
    problemMotivation: draft.problemMotivation,
    projectGoal: draft.projectGoal,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  };
  writeBoth(storageKey(projectId), JSON.stringify(next));
}

export function clearProjectBriefDraft(projectId: string): void {
  if (typeof window === "undefined" || !projectId) return;
  removeBoth(storageKey(projectId));
}

/** ホーム復帰時に一覧ではなく概要のゴール入力へ戻す判定 */
export function hasOpenProjectBriefDraft(projectId: string | null | undefined): boolean {
  if (!projectId) return false;
  const draft = readProjectBriefDraft(projectId);
  return Boolean(draft?.open);
}
