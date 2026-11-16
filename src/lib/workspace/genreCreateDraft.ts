import { CUSTOM_GENRE_ICON_PRESETS } from "@/lib/workspace/taskGenres";

export type GenreCreateDraft = {
  label: string;
  hint: string;
  colorKey: string;
  iconKey: string;
  updatedAt: number;
};

function storageKey(projectId: string, phaseId: string | null): string {
  return `moni:genreCreateDraft:v1:${projectId}:${phaseId ?? "none"}`;
}

function openSessionKey(projectId: string): string {
  return `moni:genreCreateOpen:v1:${projectId}`;
}

function isKnownIconKey(key: string): boolean {
  return CUSTOM_GENRE_ICON_PRESETS.some((preset) => preset.key === key);
}

export function readGenreCreateDraft(
  projectId: string,
  phaseId: string | null,
): GenreCreateDraft | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(projectId, phaseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GenreCreateDraft>;
    const iconKey =
      typeof parsed.iconKey === "string" && isKnownIconKey(parsed.iconKey)
        ? parsed.iconKey
        : CUSTOM_GENRE_ICON_PRESETS[0]!.key;
    return {
      label: typeof parsed.label === "string" ? parsed.label : "",
      hint: typeof parsed.hint === "string" ? parsed.hint : "",
      colorKey: typeof parsed.colorKey === "string" ? parsed.colorKey : "",
      iconKey,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeGenreCreateDraft(
  projectId: string,
  phaseId: string | null,
  draft: Omit<GenreCreateDraft, "updatedAt">,
) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    const payload: GenreCreateDraft = { ...draft, updatedAt: Date.now() };
    window.sessionStorage.setItem(storageKey(projectId, phaseId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearGenreCreateDraft(projectId: string, phaseId: string | null) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.removeItem(storageKey(projectId, phaseId));
  } catch {
    /* ignore */
  }
}

/** ジャンル作成ウィザードを開いていることを覚える（他画面へ行っても再開するため） */
export function markGenreCreateOpen(projectId: string, phaseId: string | null) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.setItem(
      openSessionKey(projectId),
      JSON.stringify({ phaseId, openedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function clearGenreCreateOpen(projectId: string) {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.sessionStorage.removeItem(openSessionKey(projectId));
  } catch {
    /* ignore */
  }
}

export function readGenreCreateOpen(
  projectId: string,
): { phaseId: string | null } | null {
  if (typeof window === "undefined" || !projectId) return null;
  try {
    const raw = window.sessionStorage.getItem(openSessionKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { phaseId?: unknown };
    const phaseId =
      parsed.phaseId === null
        ? null
        : typeof parsed.phaseId === "string"
          ? parsed.phaseId
          : null;
    return { phaseId };
  } catch {
    return null;
  }
}

export function shouldResumeGenreCreate(projectId: string, phaseId: string | null): boolean {
  const open = readGenreCreateOpen(projectId);
  if (open && (open.phaseId ?? null) === (phaseId ?? null)) return true;
  return Boolean(readGenreCreateDraft(projectId, phaseId));
}
