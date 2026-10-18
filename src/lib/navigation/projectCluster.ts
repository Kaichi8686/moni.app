/** Bottom-nav project cluster expand/collapse (session). */
export const PROJECT_CLUSTER_STORAGE_KEY = "moni.nav.projectClusterOpen";
export const PROJECT_CLUSTER_UNLOCK_KEY = "moni.nav.projectClusterUnlocked";

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
}

/** Open the project cluster and unlock expand/collapse for this session. */
export function openProjectCluster() {
  markProjectClusterUnlocked();
  writeStoredProjectClusterOpen(true);
}

/** True when URL is inside a specific project workspace (not the /projects list). */
export function isInsideProjectWorkspace(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return /^\/projects\/[0-9a-f-]{36}(?:\/|$)/i.test(pathname);
}
