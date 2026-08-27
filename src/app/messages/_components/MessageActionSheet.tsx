"use client";

import type { ComponentType } from "react";
import {
  Bookmark,
  Clipboard,
  Pencil,
  Reply,
  Trash2,
} from "lucide-react";
import type { Message } from "@/lib/types/messages";
import {
  MESSAGES_OVERLAY_CLASS,
  MESSAGES_OVERLAY_PANEL_CLASS,
} from "@/lib/messages/overlayRoot";
import { useI18n } from "@/lib/i18n/I18nProvider";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

type Props = {
  message: Message;
  isMine: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onMoreReactions: () => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTranslate?: () => void;
  onClose: () => void;
};

function ActionItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm ${
        danger ? "text-red-600" : "text-zinc-800"
      } hover:bg-zinc-50`}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-70" />
      {label}
    </button>
  );
}

export function MessageActionSheet({
  message,
  isMine,
  onReply,
  onReact,
  onMoreReactions,
  onPin,
  onEdit,
  onDelete,
  onTranslate,
  onClose,
}: Props) {
  const { tx } = useI18n();
  const copyText = () => {
    if (message.content) void navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={MESSAGES_OVERLAY_CLASS}>
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-black/40"
        aria-label={tx("閉じる", "Close")}
        onClick={onClose}
      />
      <div
        className={`${MESSAGES_OVERLAY_PANEL_CLASS} rounded-t-2xl bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl`}
      >
        <div className="flex justify-around border-b px-6 pb-3 pt-4">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="text-2xl transition-transform active:scale-110 hover:scale-125"
            >
              {emoji}
            </button>
          ))}
          <button type="button" onClick={onMoreReactions} className="text-xl text-zinc-500">
            ＋
          </button>
        </div>
        <div className="py-2">
          <ActionItem icon={Reply} label={tx("返信", "Reply")} onClick={() => { onReply(); onClose(); }} />
          {onTranslate ? (
            <ActionItem icon={Clipboard} label={tx("翻訳", "Translate")} onClick={() => { onTranslate(); onClose(); }} />
          ) : null}
          <ActionItem icon={Bookmark} label={tx("ピン止め", "Pin")} onClick={() => { onPin(); onClose(); }} />
          {isMine ? <ActionItem icon={Pencil} label={tx("編集", "Edit")} onClick={() => { onEdit(); onClose(); }} /> : null}
          <ActionItem
            icon={Clipboard}
            label={tx("コピー", "Copy")}
            onClick={() => {
              copyText();
              onClose();
            }}
          />
          {isMine ? (
            <ActionItem
              icon={Trash2}
              label={tx("取り消す", "Unsend")}
              danger
              onClick={() => {
                onDelete();
                onClose();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
