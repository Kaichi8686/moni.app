export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AiSavedConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
};

export type AiConversationStore = {
  activeId: string;
  conversations: AiSavedConversation[];
};

export const AI_CHAT_LIMITS = {
  maxConversations: 30,
  maxMessages: 100,
} as const;

export function newAiId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function titleFromMessages(messages: AiChatMessage[], fallback: string): string {
  const firstUser = messages.find((m) => m.role === "user")?.content.trim();
  if (!firstUser) return fallback;
  return firstUser.slice(0, 36);
}

export function normalizeMessages(raw: unknown, max = AI_CHAT_LIMITS.maxMessages): AiChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): AiChatMessage | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<AiChatMessage> & { role?: string; content?: string; id?: string };
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return null;
      const id = typeof row.id === "string" && row.id ? row.id : newAiId(row.role === "user" ? "u" : "a");
      return { id, role: row.role, content: row.content };
    })
    .filter((m): m is AiChatMessage => m !== null)
    .slice(-max);
}

export function normalizeConversations(raw: unknown, max = AI_CHAT_LIMITS.maxConversations): AiSavedConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): AiSavedConversation | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<AiSavedConversation>;
      if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.updatedAt !== "string") {
        return null;
      }
      const messages = normalizeMessages(row.messages);
      if (messages.length === 0) return null;
      return { id: row.id, title: row.title, updatedAt: row.updatedAt, messages };
    })
    .filter((c): c is AiSavedConversation => c !== null)
    .slice(0, max);
}

export function loadConversationStore(storageKey: string): AiConversationStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { activeId?: unknown; conversations?: unknown };
    const conversations = normalizeConversations(parsed.conversations);
    if (conversations.length === 0) return null;
    const requestedId = typeof parsed.activeId === "string" ? parsed.activeId : "";
    const active = conversations.find((c) => c.id === requestedId) ?? conversations[0]!;
    return { activeId: active.id, conversations };
  } catch {
    return null;
  }
}

export function saveConversationStore(storageKey: string, store: AiConversationStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        activeId: store.activeId,
        conversations: store.conversations.slice(0, AI_CHAT_LIMITS.maxConversations),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function upsertActiveConversation(
  previous: AiSavedConversation[],
  activeId: string,
  messages: AiChatMessage[],
  titleFallback: string,
): AiSavedConversation[] {
  const next: AiSavedConversation = {
    id: activeId,
    title: titleFromMessages(messages, titleFallback),
    updatedAt: new Date().toISOString(),
    messages: messages.slice(-AI_CHAT_LIMITS.maxMessages),
  };
  const remaining = previous.filter((c) => c.id !== activeId);
  return [next, ...remaining].slice(0, AI_CHAT_LIMITS.maxConversations);
}

/** Migrate legacy single-thread message arrays into one conversation. */
export function conversationFromLegacyMessages(
  legacyKey: string,
  titleFallback: string,
): AiSavedConversation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(legacyKey);
    if (!raw) return null;
    const messages = normalizeMessages(JSON.parse(raw));
    if (messages.length === 0) return null;
    return {
      id: newAiId("migrated"),
      title: titleFromMessages(messages, titleFallback),
      updatedAt: new Date().toISOString(),
      messages,
    };
  } catch {
    return null;
  }
}
