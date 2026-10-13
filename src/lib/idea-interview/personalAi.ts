import {
  loadConversationStore,
  newAiId,
  saveConversationStore,
  type AiChatMessage,
  type AiSavedConversation,
} from "@/lib/ai/chatConversations";

/** Personal consult AI (Ideas tab) — never share with project gemini keys. */
export const IDEA_CONSULT_CONVERSATIONS_KEY = "moni.ideaConsult.conversations.v1";

export type IdeaPersonalAiMode = "consult" | "excavate";

export function ideaConsultStorageKey(ownerKey: string): string {
  return `${IDEA_CONSULT_CONVERSATIONS_KEY}:${ownerKey}`;
}

export const IDEA_CONSULT_WELCOME =
  "こんにちは 😊 なんでも気軽に送ってみてください。雑談でも相談でも、そのままの言葉で大丈夫です。**大事なところは太字**で見やすく答えますね。";

export function createConsultWelcomeMessage(): AiChatMessage {
  return {
    id: newAiId("a"),
    role: "assistant",
    content: IDEA_CONSULT_WELCOME,
  };
}

export function blankConsultConversation(titleFallback: string): AiSavedConversation {
  const welcome = createConsultWelcomeMessage();
  return {
    id: newAiId("consult"),
    title: titleFallback,
    updatedAt: new Date().toISOString(),
    messages: [welcome],
  };
}

export function loadConsultConversations(
  ownerKey: string,
  titleFallback: string,
): { activeId: string; conversations: AiSavedConversation[] } {
  const existing = loadConversationStore(ideaConsultStorageKey(ownerKey));
  if (existing?.conversations.length) {
    return existing;
  }
  const blank = blankConsultConversation(titleFallback);
  return { activeId: blank.id, conversations: [blank] };
}

export function saveConsultConversations(
  ownerKey: string,
  activeId: string,
  conversations: AiSavedConversation[],
): void {
  saveConversationStore(ideaConsultStorageKey(ownerKey), { activeId, conversations });
}
