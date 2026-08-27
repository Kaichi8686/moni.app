"use client";

import {
  MESSAGES_OVERLAY_CLASS,
  MESSAGES_OVERLAY_PANEL_CLASS,
} from "@/lib/messages/overlayRoot";
import { useI18n } from "@/lib/i18n/I18nProvider";

const EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍", "🙏", "✨"];

type Props = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPicker({ onSelect, onClose }: Props) {
  const { tx } = useI18n();
  return (
    <div className={`${MESSAGES_OVERLAY_CLASS} items-center`}>
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-black/30"
        aria-label={tx("閉じる", "Close")}
        onClick={onClose}
      />
      <div
        className={`${MESSAGES_OVERLAY_PANEL_CLASS} flex justify-center px-4`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex gap-2 rounded-2xl bg-white px-4 py-3 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-2xl transition-transform hover:scale-125"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
