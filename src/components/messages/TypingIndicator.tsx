"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { subscribeTypingUsers, type TypingPresence } from "@/lib/messages/typing";

type Props = { conversationId: string; currentUserId: string | null };

export function TypingIndicator({ conversationId, currentUserId }: Props) {
  const { tx } = useI18n();
  const [typingUsers, setTypingUsers] = useState<TypingPresence[]>([]);

  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }
    return subscribeTypingUsers((users) => {
      // 自分自身の入力中は表示しない（相手の名前だけ）
      const others = users.filter(
        (u) => u.isTyping && u.userId && u.userId !== currentUserId && u.displayName.trim(),
      );
      // userId で一意化
      const unique = new Map<string, TypingPresence>();
      for (const u of others) unique.set(u.userId, u);
      setTypingUsers([...unique.values()]);
    });
  }, [conversationId, currentUserId]);

  if (typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? tx(`${typingUsers[0].displayName}が入力中...`, `${typingUsers[0].displayName} is typing…`)
      : tx(`${typingUsers.length}人が入力中...`, `${typingUsers.length} people are typing…`);

  return (
    <div className="flex items-center gap-2 px-1 py-1" role="status" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
