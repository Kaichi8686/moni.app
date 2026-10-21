/** Profile-block inbox: keep DMs the user opened even before the first message. */
const STORAGE_KEY = "moni.messages.openedDirectConversations";
const MAX_IDS = 200;
export const OPENED_DIRECT_CHANGE_EVENT = "moni:opened-direct-conversations";

function notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(OPENED_DIRECT_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_IDS)));
  } catch {
    /* ignore */
  }
  notify();
}

export function readOpenedDirectConversationIds(): Set<string> {
  return new Set(readIds());
}

export function markDirectConversationOpened(conversationId: string) {
  const id = conversationId.trim();
  if (!id) return;
  const prev = readIds().filter((x) => x !== id);
  writeIds([id, ...prev]);
}

export function subscribeOpenedDirectConversations(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(OPENED_DIRECT_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(OPENED_DIRECT_CHANGE_EVENT, onStoreChange);
  };
}
