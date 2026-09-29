import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type TypingPresence = {
  userId: string;
  displayName: string;
  isTyping: boolean;
};

type TypingListener = (users: TypingPresence[]) => void;

let typingChannel: RealtimeChannel | null = null;
let typingTimer: ReturnType<typeof setTimeout> | null = null;
let boundConversationId: string | null = null;
let boundUserId: string | null = null;
let boundDisplayName: string | null = null;
const listeners = new Set<TypingListener>();

function presenceList(channel: RealtimeChannel): TypingPresence[] {
  const state = channel.presenceState() as Record<string, TypingPresence[]>;
  const out: TypingPresence[] = [];
  for (const [key, metas] of Object.entries(state)) {
    for (const meta of metas ?? []) {
      const userId = meta.userId || key;
      const displayName = (meta.displayName || "").trim();
      if (!userId || !displayName) continue;
      out.push({
        userId,
        displayName,
        isTyping: Boolean(meta.isTyping),
      });
    }
  }
  return out;
}

function emitPresence() {
  if (!typingChannel) {
    for (const listener of listeners) listener([]);
    return;
  }
  const list = presenceList(typingChannel);
  for (const listener of listeners) listener(list);
}

export function subscribeTypingUsers(listener: TypingListener): () => void {
  listeners.add(listener);
  if (typingChannel) listener(presenceList(typingChannel));
  else listener([]);
  return () => {
    listeners.delete(listener);
  };
}

export function bindTypingChannel(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
  displayName: string,
) {
  const name = displayName.trim() || "ユーザー";
  if (
    typingChannel &&
    boundConversationId === conversationId &&
    boundUserId === userId &&
    boundDisplayName === name
  ) {
    return typingChannel;
  }

  unbindTypingChannel();
  boundConversationId = conversationId;
  boundUserId = userId;
  boundDisplayName = name;

  typingChannel = client.channel(`typing:${conversationId}`, {
    config: { presence: { key: userId } },
  });

  typingChannel.on("presence", { event: "sync" }, () => emitPresence());
  typingChannel.on("presence", { event: "join" }, () => emitPresence());
  typingChannel.on("presence", { event: "leave" }, () => emitPresence());

  void typingChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await typingChannel?.track({
        userId,
        displayName: name,
        isTyping: false,
      } satisfies TypingPresence);
      emitPresence();
    }
  });

  return typingChannel;
}

export function broadcastTyping(displayName?: string) {
  if (!typingChannel || !boundUserId) return;
  const name = (displayName ?? boundDisplayName ?? "").trim() || "ユーザー";
  void typingChannel.track({
    userId: boundUserId,
    displayName: name,
    isTyping: true,
  } satisfies TypingPresence);
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    void typingChannel?.track({
      userId: boundUserId!,
      displayName: name,
      isTyping: false,
    } satisfies TypingPresence);
  }, 2000);
}

export function clearTyping() {
  if (!typingChannel || !boundUserId) return;
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  const name = (boundDisplayName ?? "").trim() || "ユーザー";
  void typingChannel.track({
    userId: boundUserId,
    displayName: name,
    isTyping: false,
  } satisfies TypingPresence);
}

export function unbindTypingChannel() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
  if (typingChannel) {
    void typingChannel.untrack();
    void typingChannel.unsubscribe();
    typingChannel = null;
  }
  boundConversationId = null;
  boundUserId = null;
  boundDisplayName = null;
  emitPresence();
}
