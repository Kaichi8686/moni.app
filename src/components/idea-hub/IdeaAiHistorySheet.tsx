"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AiSavedConversation } from "@/lib/ai/chatConversations";
import {
  loadIdeaInterviewConversations,
  type IdeaInterviewConversation,
} from "@/lib/idea-interview/conversations";
import {
  loadConsultConversations,
  type IdeaPersonalAiMode,
} from "@/lib/idea-interview/personalAi";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type HistoryRow = {
  id: string;
  title: string;
  updatedAt: string;
  mode: IdeaPersonalAiMode;
};

function toRows(
  excavate: IdeaInterviewConversation[],
  consult: AiSavedConversation[],
): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...excavate.map((c) => ({
      id: `excavate:${c.id}`,
      title: c.title,
      updatedAt: c.updatedAt,
      mode: "excavate" as const,
    })),
    ...consult.map((c) => ({
      id: `consult:${c.id}`,
      title: c.title,
      updatedAt: c.updatedAt,
      mode: "consult" as const,
    })),
  ];
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function IdeaAiHistorySheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (mode: IdeaPersonalAiMode) => void;
}) {
  const { tx, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let ownerKey = "guest";
      if (supabase) {
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
          ]);
          const uid = result && "data" in result ? result.data.session?.user.id : undefined;
          if (uid) ownerKey = uid;
        } catch {
          /* guest */
        }
      }
      if (cancelled) return;
      const newTitle = tx("新しいチャット", "New chat");
      const excavate = loadIdeaInterviewConversations(ownerKey, newTitle);
      const consult = loadConsultConversations(ownerKey, newTitle);
      setRows(toRows(excavate.conversations, consult.conversations));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tx]);

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={tx("チャット履歴", "Chat history")}
      onClick={onClose}
    >
      <div
        className="flex h-full w-[min(100%,320px)] flex-col bg-[#f7f7f8] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
          <p className="text-sm font-semibold text-[#111827]">{tx("チャット履歴", "Chat history")}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] hover:bg-white"
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tx("読み込み中…", "Loading…")}
          </div>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {rows.length === 0 ? (
              <li className="px-2 py-6 text-center text-[12px] text-[#9ca3af]">
                {tx("まだ会話がありません", "No chats yet")}
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.mode)}
                    className="w-full rounded-xl border border-transparent px-2.5 py-2.5 text-left hover:border-[#e5e7eb] hover:bg-white"
                  >
                    <span className="mb-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200">
                      {row.mode === "consult" ? tx("相談", "Chat") : tx("発掘", "Discover")}
                    </span>
                    <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-[#111827]">
                      {row.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                      {new Date(row.updatedAt).toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
