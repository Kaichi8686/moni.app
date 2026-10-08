"use client";

import { X } from "lucide-react";
import type { Message } from "@/lib/types/messages";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  message: Message;
  onCancel: () => void;
};

export function ReplyPreview({ message, onCancel }: Props) {
  const { tx } = useI18n();
  return (
    <div className="flex items-center gap-2 border-t border-[var(--brand-muted,#ffd9cc)] bg-[var(--brand-soft,#fff4f0)] px-3 py-2">
      <div className="min-w-0 flex-1 border-l-2 border-[var(--brand,#ff5c35)] pl-2">
        <p className="text-xs font-medium text-[var(--brand-ink,#9a3412)]">{message.sender.displayName}</p>
        <p className="truncate text-xs text-[var(--brand,#ff5c35)]">
          {message.isDeleted ? tx("メッセージを取り消しました", "Message unsent") : message.content}
        </p>
      </div>
      <button type="button" onClick={onCancel} className="rounded-full p-1 text-zinc-500 hover:bg-[var(--brand-soft,#fff4f0)]">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
