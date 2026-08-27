"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = { conversationId: string; currentUserId: string | null };

export function TypingIndicator({ conversationId, currentUserId }: Props) {
  const { tx } = useI18n();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const client = supabase;
    if (!client || !conversationId) return;

    const channel = client.channel(`typing:${conversationId}`, {
      config: { presence: { key: currentUserId ?? "anon" } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<{ displayName?: string; isTyping?: boolean }>>;
      const names = Object.values(state)
        .flat()
        .filter((p) => p.isTyping && p.displayName)
        .map((p) => p.displayName as string);
      setTypingUsers(names);
    });

    void channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  if (typingUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        {typingUsers.length === 1
          ? tx(`${typingUsers[0]}が入力中...`, `${typingUsers[0]} is typing…`)
          : tx(`${typingUsers.length}人が入力中...`, `${typingUsers.length} people are typing…`)}
      </span>
    </div>
  );
}
