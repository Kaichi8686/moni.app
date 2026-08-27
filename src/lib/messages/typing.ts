import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

let typingChannel: RealtimeChannel | null = null;
let typingTimer: ReturnType<typeof setTimeout> | null = null;

export function bindTypingChannel(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
  displayName: string,
) {
  typingChannel?.unsubscribe();
  typingChannel = client.channel(`typing:${conversationId}`, {
    config: { presence: { key: userId } },
  });
  void typingChannel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await typingChannel?.track({ displayName, isTyping: false });
    }
  });
  return typingChannel;
}

export function broadcastTyping(displayName: string) {
  if (!typingChannel) return;
  void typingChannel.track({ displayName, isTyping: true });
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    void typingChannel?.track({ displayName, isTyping: false });
  }, 2000);
}

export function unbindTypingChannel() {
  if (typingTimer) clearTimeout(typingTimer);
  typingChannel?.unsubscribe();
  typingChannel = null;
}
