/** Bottom-nav project cluster expand/collapse (session). */
export const PROJECT_CLUSTER_STORAGE_KEY = "moni.nav.projectClusterOpen";
export const PROJECT_CLUSTER_UNLOCK_KEY = "moni.nav.projectClusterUnlocked";
/** After 「一覧に戻る」, prefer cube list over last-project redirect. */
export const PROJECT_LIST_MODE_KEY = "moni.nav.projectListMode";
/** Same-tab listeners when cluster / list-mode storage changes. */
export const PROJECT_CLUSTER_CHANGE_EVENT = "moni:project-cluster-change";

function notifyProjectClusterChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(PROJECT_CLUSTER_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function readStoredProjectClusterOpen(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROJECT_CLUSTER_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredProjectClusterOpen(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROJECT_CLUSTER_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
  notifyProjectClusterChange();
}

/** After the user opens a project once this session, the cluster can be toggled. */
export function readProjectClusterUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PROJECT_CLUSTER_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markProjectClusterUnlocked() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROJECT_CLUSTER_UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
  notifyProjectClusterChange();
}

/** Cube-list mode: Home stays on list, cluster stays locked closed (no arrow). */
export function readProjectListMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PROJECT_LIST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function exitProjectListMode() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROJECT_LIST_MODE_KEY);
  } catch {
    /* ignore */
  }
  notifyProjectClusterChange();
}

/**
 * 「一覧に戻る」: close + lock the project tab block, hide the arrow,
 * and keep Home on the cube list until a project is opened again.
 */
export function enterProjectListMode() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROJECT_LIST_MODE_KEY, "1");
    window.sessionStorage.removeItem(PROJECT_CLUSTER_UNLOCK_KEY);
    window.sessionStorage.setItem(PROJECT_CLUSTER_STORAGE_KEY, "0");
  } catch {
    /* ignore */
  }
  notifyProjectClusterChange();
}

/** Open the project cluster and unlock expand/collapse for this session. */
export function openProjectCluster() {
  exitProjectListMode();
  markProjectClusterUnlocked();
  writeStoredProjectClusterOpen(true);
}

/** Collapse to the profile tab block (Messages / AI / Find). */
export function closeProjectCluster() {
  writeStoredProjectClusterOpen(false);
}

/** True when URL is inside a specific project workspace (not the /projects list). */
export function isInsideProjectWorkspace(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/projects\/[0-9a-f-]{36}(?:\/|$)/i.test(pathname);
}

export function subscribeProjectCluster(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (
      !e.key ||
      e.key === PROJECT_CLUSTER_STORAGE_KEY ||
      e.key === PROJECT_CLUSTER_UNLOCK_KEY ||
      e.key === PROJECT_LIST_MODE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PROJECT_CLUSTER_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROJECT_CLUSTER_CHANGE_EVENT, onStoreChange);
  };
}
