/** プロフィール側メール vs プロジェクト側メールの文脈を session で保持 */

export const MAIL_PROJECT_SCOPE_KEY = "moni.mail.projectScope";
export const MAIL_SCOPE_CHANGE_EVENT = "moni:mail-scope-change";

const PROJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(MAIL_SCOPE_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function isProjectId(value: string | null | undefined): value is string {
  return Boolean(value && PROJECT_UUID_RE.test(value));
}

/** いま開いているのがプロジェクト側メールならその projectId、プロフィール側なら null */
export function readMailProjectScope(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MAIL_PROJECT_SCOPE_KEY)?.trim() ?? "";
    return isProjectId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeMailProjectScope(projectId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (isProjectId(projectId)) {
      window.sessionStorage.setItem(MAIL_PROJECT_SCOPE_KEY, projectId);
    } else {
      window.sessionStorage.removeItem(MAIL_PROJECT_SCOPE_KEY);
    }
  } catch {
    /* ignore */
  }
  notify();
}

export function clearMailProjectScope() {
  writeMailProjectScope(null);
}

/** 会話 URL。プロジェクト側なら ?project= を付ける */
export function conversationHref(conversationId: string, projectId?: string | null): string {
  if (isProjectId(projectId)) {
    return `/messages/${conversationId}?project=${encodeURIComponent(projectId)}`;
  }
  return `/messages/${conversationId}`;
}

/** メール一覧 URL */
export function mailInboxHref(projectId?: string | null): string {
  if (isProjectId(projectId)) {
    return `/messages?project=${encodeURIComponent(projectId)}`;
  }
  return "/messages";
}

export function subscribeMailProjectScope(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === MAIL_PROJECT_SCOPE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MAIL_SCOPE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MAIL_SCOPE_CHANGE_EVENT, onStoreChange);
  };
}
