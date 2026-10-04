"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { AiSavedConversation } from "@/lib/ai/chatConversations";

type Props = {
  conversations: AiSavedConversation[];
  activeId: string;
  onSelect: (conversation: AiSavedConversation) => void;
  onNew: () => void;
  onDelete: (conversationId: string) => void;
  locale?: string;
  title?: string;
  newLabel?: string;
  emptyLabel?: string;
  className?: string;
};

export function AiChatHistoryRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  locale = "ja-JP",
  title = "チャット履歴",
  newLabel = "新しいチャット",
  emptyLabel = "まだ会話がありません",
  className = "",
}: Props) {
  return (
    <aside className={`flex h-full min-h-0 flex-col bg-[#f7f7f8] ${className}`}>
      <div className="shrink-0 border-b border-[#e5e7eb] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">{title}</p>
        <button
          type="button"
          onClick={onNew}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#d1d5db] bg-white px-3 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f9fafb]"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          {newLabel}
        </button>
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <li className="px-2 py-6 text-center text-[12px] text-[#9ca3af]">{emptyLabel}</li>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <div
                  className={`group flex items-stretch gap-1 rounded-xl border ${
                    active
                      ? "border-[var(--brand-muted,#ffd9cc)] bg-[var(--brand-soft,#fff4f0)]"
                      : "border-transparent bg-transparent hover:border-[#e5e7eb] hover:bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className="min-w-0 flex-1 rounded-xl px-2.5 py-2.5 text-left"
                  >
                    <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-[#111827]">
                      {conversation.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                      {new Date(conversation.updatedAt).toLocaleString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${conversation.title}を削除`}
                    onClick={() => onDelete(conversation.id)}
                    className="m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9ca3af] opacity-70 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
