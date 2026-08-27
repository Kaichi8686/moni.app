"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ja, enUS } from "date-fns/locale";
import { Pencil, Search } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { NewConversationModal } from "@/app/messages/_components/NewConversationModal";
import { fetchInboxConversations } from "@/lib/messages/api";
import { ensureRealtimeAuth } from "@/lib/messages/ensureRealtimeAuth";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import type { InboxConversation } from "@/lib/types/messages";

function safeTimeAgo(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { locale: locale === "en" ? enUS : ja, addSuffix: false });
  } catch {
    return "";
  }
}

function lastMessagePreview(conv: InboxConversation, locale: "ja" | "en"): string {
  const m = conv.lastMessage;
  const en = locale === "en";
  if (!m) return en ? "Send a message" : "メッセージを送ってみましょう";
  if (m.isDeleted) return en ? "Message deleted" : "メッセージを取り消しました";
  if (m.contentType === "voice") return en ? "🎤 Voice message" : "🎤 ボイスメッセージ";
  if (m.contentType === "image") return en ? "📷 Photo" : "📷 写真";
  if (m.contentType === "collab_request") return en ? "🤝 Collab request" : "🤝 コラボ依頼";
  if (m.contentType === "task_card") return en ? "✅ Task" : "✅ タスク";
  return m.content?.trim() || "";
}

export function InboxList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, tx } = useI18n();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const peerHandledRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoadError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;
      setUserId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }
      const rows = await fetchInboxConversations(supabase, uid);
      setConversations(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setLoadError(msg.includes("conversation") ? "__db__" : msg || "__generic__");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let cancelled = false;

    const channel = client
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          if (!cancelled) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          if (!cancelled) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        () => {
          if (!cancelled) void load();
        },
      )
      .subscribe();

    void ensureRealtimeAuth(client);

    const poll = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") void load();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [userId, load]);

  useEffect(() => {
    const peer = searchParams.get("peer")?.trim();
    if (!peer || !supabase || !userId || peer === userId) return;
    if (peerHandledRef.current === peer) return;
    peerHandledRef.current = peer;
    router.replace("/messages");
    void navigateToDirectMessage(supabase, router, peer);
  }, [searchParams, userId, router]);

  const filtered = useMemo(() => {
    let list = [...conversations];
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (filter === "groups") list = list.filter((c) => c.type === "group" || c.type === "project");
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const title =
          c.type === "direct" ? (c.otherUser?.displayName ?? "") : (c.name ?? "");
        return title.toLowerCase().includes(q) || lastMessagePreview(c, locale).toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return list;
  }, [conversations, filter, searchQuery, locale]);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-bottom-nav">
      <div className="mobile-sticky-header mobile-content-inset flex items-center justify-between py-3">
        <h1 className="text-lg font-bold text-zinc-900">{tx("メッセージ", "Messages")}</h1>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="touch-target inline-flex items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
          aria-label={tx("新しいチャット", "New chat")}
        >
          <Pencil className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            placeholder={tx("検索", "Search")}
            className="flex-1 bg-transparent text-sm outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="border-b px-4 py-2">
        <label className="sr-only" htmlFor="inbox-filter">
          {tx("フィルタ", "Filter")}
        </label>
        <select
          id="inbox-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[15px] text-zinc-800"
        >
          <option value="all">{tx("すべて", "All")}</option>
          <option value="unread">{tx("未読", "Unread")}</option>
          <option value="groups">{tx("グループ", "Groups")}</option>
        </select>
      </div>

      <div className="flex-1 divide-y divide-zinc-50 overflow-y-auto">
        {!userId ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            <Link href="/" className="font-medium text-violet-600 underline">
              {tx("ログイン", "Log in")}
            </Link>
            {tx("するとメッセージが表示されます", " to see your messages")}
          </p>
        ) : loadError ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            {loadError === "__db__"
              ? tx("メッセージ機能のDBが未設定です。Supabaseで SQL を実行してください。", "Messaging is not set up. Run the SQL in Supabase.")
              : loadError === "__generic__"
                ? tx("読み込みに失敗しました", "Failed to load")
                : loadError}
          </p>
        ) : loading ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">{tx("読み込み中...", "Loading…")}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            {tx("まだトークがありません。右上から新規チャットを始めましょう。", "No chats yet. Tap the pencil to start one.")}
          </p>
        ) : (
          filtered.map((conv) => <ConversationRow key={conv.id} conversation={conv} />)
        )}
      </div>

      {showNew && userId ? (
        <NewConversationModal
          currentUserId={userId}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: InboxConversation }) {
  const { locale, tx } = useI18n();
  const isUnread = conversation.unreadCount > 0;
  const title =
    conversation.type === "direct"
      ? (conversation.otherUser?.displayName ?? tx("ユーザー", "User"))
      : (conversation.name ?? tx("グループ", "Group"));

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center px-4 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="relative mr-3 shrink-0">
        {conversation.type === "direct" && conversation.otherUser ? (
          <MemberAvatarBubble
            userId={conversation.otherUser.id}
            name={conversation.otherUser.displayName}
            avatarUrl={conversation.otherUser.avatarUrl}
            size="md"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl">
            {conversation.iconEmoji}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <span
            className={`truncate text-sm ${
              isUnread ? "font-bold text-zinc-900" : "font-medium text-zinc-800"
            }`}
          >
            {title}
          </span>
          <span className="ml-2 shrink-0 text-xs text-zinc-400">
            {safeTimeAgo(conversation.lastMessageAt, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`truncate text-xs ${isUnread ? "text-zinc-900" : "text-zinc-500"}`}>
            {lastMessagePreview(conversation, locale)}
          </span>
          {isUnread ? (
            <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs text-white">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
