const ID_KEY = "moni:lastProjectId";
const NAME_KEY = "moni:lastProjectName";
/** Ordered most-recent-first project ids for the cube carousel. */
const RECENT_IDS_KEY = "moni:recentProjectIds";
const MAX_RECENT = 120;
/** Same-tab listeners (storage イベントは他タブのみ) */
export const LAST_PROJECT_CHANGE_EVENT = "moni:last-project-change";

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function removeStorage(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function notifyLastProjectChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(LAST_PROJECT_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

function parseRecentIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writeRecentIds(storage: Storage, ids: string[]) {
  writeStorage(storage, RECENT_IDS_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

function touchRecentProjectId(projectId: string) {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const prev = parseRecentIds(readStorage(storage, RECENT_IDS_KEY));
    const next = [projectId, ...prev.filter((id) => id !== projectId)].slice(0, MAX_RECENT);
    writeRecentIds(storage, next);
  }
}

function removeRecentProjectId(projectId: string): boolean {
  let changed = false;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const prev = parseRecentIds(readStorage(storage, RECENT_IDS_KEY));
    if (!prev.includes(projectId)) continue;
    writeRecentIds(
      storage,
      prev.filter((id) => id !== projectId),
    );
    changed = true;
  }
  return changed;
}

/** Most-recently-opened project ids (newest first). Falls back across local → session. */
export function readRecentProjectIds(): string[] {
  if (typeof window === "undefined") return [];
  const fromLocal = parseRecentIds(readStorage(window.localStorage, RECENT_IDS_KEY));
  const fromSession = parseRecentIds(readStorage(window.sessionStorage, RECENT_IDS_KEY));
  const ids = fromLocal.length > 0 ? fromLocal : fromSession;
  if (ids.length > 0) return ids;
  // Migrate: users who only have the single last-project key
  const lastId =
    readStorage(window.localStorage, ID_KEY) ?? readStorage(window.sessionStorage, ID_KEY);
  return lastId ? [lastId] : [];
}

export function rememberLastProject(projectId: string, projectName: string) {
  if (typeof window === "undefined") return;
  writeStorage(window.localStorage, ID_KEY, projectId);
  writeStorage(window.localStorage, NAME_KEY, projectName);
  writeStorage(window.sessionStorage, ID_KEY, projectId);
  writeStorage(window.sessionStorage, NAME_KEY, projectName);
  touchRecentProjectId(projectId);
  notifyLastProjectChange();
}

export function clearLastProjectIfMatches(projectId: string) {
  if (typeof window === "undefined") return;
  let changed = false;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    if (readStorage(storage, ID_KEY) === projectId) {
      removeStorage(storage, ID_KEY);
      removeStorage(storage, NAME_KEY);
      changed = true;
    }
  }
  if (removeRecentProjectId(projectId)) changed = true;
  if (changed) notifyLastProjectChange();
}

export function readLastProject(): { id: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const id =
    readStorage(window.localStorage, ID_KEY) ?? readStorage(window.sessionStorage, ID_KEY);
  const name =
    readStorage(window.localStorage, NAME_KEY) ?? readStorage(window.sessionStorage, NAME_KEY);
  if (!id) return null;
  return { id, name: name?.trim() || "プロジェクト" };
}
