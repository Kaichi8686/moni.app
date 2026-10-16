const ID_KEY = "moni:lastProjectId";
const NAME_KEY = "moni:lastProjectName";
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

export function rememberLastProject(projectId: string, projectName: string) {
  if (typeof window === "undefined") return;
  writeStorage(window.localStorage, ID_KEY, projectId);
  writeStorage(window.localStorage, NAME_KEY, projectName);
  writeStorage(window.sessionStorage, ID_KEY, projectId);
  writeStorage(window.sessionStorage, NAME_KEY, projectName);
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
