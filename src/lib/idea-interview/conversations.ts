import {
  AI_CHAT_LIMITS,
  newAiId,
  normalizeMessages,
  titleFromMessages,
  type AiChatMessage,
} from "@/lib/ai/chatConversations";
import {
  IDEA_INTERVIEW_STORAGE_KEY,
  type IdeaInterviewPhase,
  type IdeaInterviewSession,
  type IdeaInterviewTheme,
  type IdeaSeed,
} from "@/lib/idea-interview/types";
import { emptySession } from "@/lib/idea-interview/session";

/** Multi-thread history for Ideas excavate AI (personal or project-scoped). */
export const IDEA_INTERVIEW_CONVERSATIONS_KEY = "moni.ideaInterview.conversations.v1";

export type IdeaInterviewThreadMeta = {
  theme: IdeaInterviewTheme | null;
  phase: IdeaInterviewPhase;
  userTurns: number;
  seeds: IdeaSeed[];
  readyForIdeas: boolean;
};

export type IdeaInterviewConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
  meta: IdeaInterviewThreadMeta;
};

function defaultMeta(): IdeaInterviewThreadMeta {
  return {
    theme: null,
    phase: "intro",
    userTurns: 0,
    seeds: [],
    readyForIdeas: false,
  };
}

function isTheme(value: unknown): value is IdeaInterviewTheme {
  return (
    value === "school" ||
    value === "parttime" ||
    value === "club" ||
    value === "friends" ||
    value === "family" ||
    value === "other"
  );
}

function isPhase(value: unknown): value is IdeaInterviewPhase {
  return value === "intro" || value === "theme" || value === "chat" || value === "results";
}

function normalizeMeta(raw: unknown): IdeaInterviewThreadMeta {
  if (!raw || typeof raw !== "object") return defaultMeta();
  const row = raw as Partial<IdeaInterviewThreadMeta>;
  const seeds = Array.isArray(row.seeds)
    ? row.seeds.filter(
        (s): s is IdeaSeed =>
          Boolean(s) &&
          typeof s === "object" &&
          typeof (s as IdeaSeed).id === "string" &&
          typeof (s as IdeaSeed).title === "string" &&
          typeof (s as IdeaSeed).summary === "string",
      )
    : [];
  return {
    theme: isTheme(row.theme) ? row.theme : null,
    phase: isPhase(row.phase) ? row.phase : seeds.length > 0 ? "results" : "intro",
    userTurns: typeof row.userTurns === "number" && row.userTurns >= 0 ? row.userTurns : 0,
    seeds,
    readyForIdeas: Boolean(row.readyForIdeas),
  };
}

function excavateStorageKey(ownerKey: string, projectId?: string): string {
  if (projectId) {
    return `${IDEA_INTERVIEW_CONVERSATIONS_KEY}:project:${projectId}:${ownerKey}`;
  }
  return `${IDEA_INTERVIEW_CONVERSATIONS_KEY}:${ownerKey}`;
}

function sessionToMessages(session: IdeaInterviewSession): AiChatMessage[] {
  return session.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));
}

function conversationFromLegacySession(
  session: IdeaInterviewSession,
  titleFallback: string,
): IdeaInterviewConversation | null {
  const messages = sessionToMessages(session);
  if (messages.length === 0 && (session.phase === "intro" || session.phase === "theme")) {
    return null;
  }
  const phase: IdeaInterviewPhase =
    session.phase === "theme" || session.phase === "intro"
      ? messages.length > 0
        ? "chat"
        : "intro"
      : session.phase;
  return {
    id: newAiId("idea"),
    title: titleFromMessages(messages, titleFallback),
    updatedAt: session.updatedAt || new Date().toISOString(),
    messages,
    meta: {
      theme: session.theme,
      phase,
      userTurns: session.userTurns,
      seeds: session.seeds,
      readyForIdeas: session.readyForIdeas,
    },
  };
}

function loadLegacySession(): IdeaInterviewSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IDEA_INTERVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdeaInterviewSession;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeIdeaConversations(raw: unknown): IdeaInterviewConversation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): IdeaInterviewConversation | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<IdeaInterviewConversation> & { meta?: unknown };
      if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.updatedAt !== "string") {
        return null;
      }
      const messages = normalizeMessages(row.messages);
      const meta = normalizeMeta(row.meta);
      // Keep empty intro threads out of persistence reload; callers create a blank if needed.
      if (messages.length === 0 && meta.phase === "intro") return null;
      return { id: row.id, title: row.title, updatedAt: row.updatedAt, messages, meta };
    })
    .filter((c): c is IdeaInterviewConversation => c !== null)
    .slice(0, AI_CHAT_LIMITS.maxConversations);
}

export function blankIdeaInterviewConversation(titleFallback: string): IdeaInterviewConversation {
  return {
    id: newAiId("idea"),
    title: titleFallback,
    updatedAt: new Date().toISOString(),
    messages: [],
    meta: defaultMeta(),
  };
}

export function loadIdeaInterviewConversations(
  ownerKey: string,
  titleFallback: string,
  projectId?: string,
): { activeId: string; conversations: IdeaInterviewConversation[] } {
  if (typeof window === "undefined") {
    const blank = blankIdeaInterviewConversation(titleFallback);
    return { activeId: blank.id, conversations: [blank] };
  }

  const key = excavateStorageKey(ownerKey, projectId);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { activeId?: unknown; conversations?: unknown };
      const conversations = normalizeIdeaConversations(parsed.conversations);
      if (conversations.length > 0) {
        const requestedId = typeof parsed.activeId === "string" ? parsed.activeId : "";
        const active = conversations.find((c) => c.id === requestedId) ?? conversations[0]!;
        return { activeId: active.id, conversations };
      }
    }
  } catch {
    /* fall through to legacy / blank */
  }

  // Legacy single-session migration is personal-only (never bleed into a project store).
  if (!projectId) {
    const legacy = loadLegacySession();
    if (legacy) {
      const migrated = conversationFromLegacySession(legacy, titleFallback);
      if (migrated) {
        const store = { activeId: migrated.id, conversations: [migrated] };
        saveIdeaInterviewConversations(ownerKey, store.activeId, store.conversations);
        try {
          window.localStorage.removeItem(IDEA_INTERVIEW_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return store;
      }
    }
  }

  const blank = blankIdeaInterviewConversation(titleFallback);
  return { activeId: blank.id, conversations: [blank] };
}

export function saveIdeaInterviewConversations(
  ownerKey: string,
  activeId: string,
  conversations: IdeaInterviewConversation[],
  projectId?: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      excavateStorageKey(ownerKey, projectId),
      JSON.stringify({
        activeId,
        conversations: conversations.slice(0, AI_CHAT_LIMITS.maxConversations),
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export function upsertIdeaInterviewConversation(
  previous: IdeaInterviewConversation[],
  activeId: string,
  messages: AiChatMessage[],
  meta: IdeaInterviewThreadMeta,
  titleFallback: string,
): IdeaInterviewConversation[] {
  const next: IdeaInterviewConversation = {
    id: activeId,
    title: titleFromMessages(messages, titleFallback),
    updatedAt: new Date().toISOString(),
    messages: messages.slice(-AI_CHAT_LIMITS.maxMessages),
    meta,
  };
  const remaining = previous.filter((c) => c.id !== activeId);
  return [next, ...remaining].slice(0, AI_CHAT_LIMITS.maxConversations);
}

export function conversationToSession(conversation: IdeaInterviewConversation): IdeaInterviewSession {
  const base = emptySession();
  return {
    ...base,
    phase: conversation.meta.phase,
    theme: conversation.meta.theme,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })),
    userTurns: conversation.meta.userTurns,
    seeds: conversation.meta.seeds,
    readyForIdeas: conversation.meta.readyForIdeas,
    updatedAt: conversation.updatedAt,
  };
}

export function sessionToThreadMeta(session: IdeaInterviewSession): IdeaInterviewThreadMeta {
  return {
    theme: session.theme,
    phase: session.phase === "theme" ? "intro" : session.phase,
    userTurns: session.userTurns,
    seeds: session.seeds,
    readyForIdeas: session.readyForIdeas,
  };
}
