"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { openDirectMessage } from "@/lib/messages/openDirectMessage";
import { markDirectConversationOpened } from "@/lib/messages/openedDirectConversations";
import { closeProjectCluster } from "@/lib/navigation/projectCluster";
import { loadFollowingListRecent } from "@/lib/profile/followActions";
import type { FollowListUser } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  currentUserId: string;
  /** Peers already shown in the inbox list — omit so they only appear once */
  excludePeerIds?: ReadonlySet<string>;
  onClose: () => void;
  onOpened: () => void;
};

export function FollowingChatPicker({
  currentUserId,
  excludePeerIds,
  onClose,
  onOpened,
}: Props) {
  const { tx } = useI18n();
  const router = useRouter();
  const [peers, setPeers] = useState<FollowListUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const list = await loadFollowingListRecent(supabase, currentUserId, 80);
      if (!cancelled) {
        setPeers(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const availablePeers = useMemo(() => {
    if (!excludePeerIds || excludePeerIds.size === 0) return peers;
    return peers.filter((u) => !excludePeerIds.has(u.id));
  }, [peers, excludePeerIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availablePeers;
    return availablePeers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [availablePeers, query]);

  async function openChat(peerId: string) {
    if (!supabase || openingId) return;
    setOpeningId(peerId);
    setError("");
    const result = await openDirectMessage(supabase, peerId);
    setOpeningId(null);
    if (result.ok) {
      markDirectConversationOpened(result.conversationId);
      closeProjectCluster();
      onOpened();
      router.push(`/messages/${result.conversationId}`);
      return;
    }
    setError(
      result.reason === "not_mutual"
        ? tx(
            "フォロー中の相手にメールできます。相手をフォローしてからもう一度試してください。",
            "You can mail people you follow. Follow them and try again.",
          )
        : tx("トークを開けませんでした", "Could not open chat"),
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="following-chat-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 id="following-chat-title" className="text-base font-semibold text-zinc-900">
            {tx("フォロー中の人とチャット", "Chat with people you follow")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-zinc-100 px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx("名前で検索", "Search by name")}
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              {tx("読み込み中…", "Loading…")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              {peers.length === 0
                ? tx(
                    "まだ誰もフォローしていません。探すタブから友達をフォローしてみましょう。",
                    "You’re not following anyone yet. Find friends in Discover.",
                  )
                : availablePeers.length === 0
                  ? tx(
                      "フォロー中の人はすでにメッセージ一覧にいます。",
                      "Everyone you follow is already in your message list.",
                    )
                  : tx("一致する人がいません", "No matches")}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={Boolean(openingId)}
                    onClick={() => void openChat(u.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <MemberAvatarBubble
                      userId={u.id}
                      name={u.displayName}
                      avatarUrl={u.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        {u.displayName}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">@{u.username}</span>
                    </span>
                    {openingId === u.id ? (
                      <span className="text-xs text-zinc-400">{tx("開いています…", "Opening…")}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="border-t border-zinc-100 px-4 py-2 text-xs text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
