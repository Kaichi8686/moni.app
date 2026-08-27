"use client";

import type { Message } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  messages: Message[];
  onJump: (id: string) => void;
};

export function PinnedMessages({ messages, onJump }: Props) {
  const { tx } = useI18n();
  if (messages.length === 0) return null;

  return (
    <div className="border-b bg-amber-50/80 px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">{tx("ピン留め", "Pinned")}</p>
      <div className="flex gap-2 overflow-x-auto">
        {messages.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onJump(m.id)}
            className="max-w-[140px] shrink-0 truncate rounded-lg bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm"
          >
            {m.isDeleted ? tx("取り消し済み", "Unsent") : m.content?.slice(0, 40) ?? tx("メッセージ", "Message")}
          </button>
        ))}
      </div>
    </div>
  );
}
