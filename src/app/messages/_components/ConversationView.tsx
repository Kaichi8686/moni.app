"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationHeader } from "@/app/messages/_components/ConversationHeader";
import { MessageBubble } from "@/app/messages/_components/MessageBubble";
import { MessageInput } from "@/app/messages/_components/MessageInput";
import { PinnedMessages } from "@/app/messages/_components/PinnedMessages";
import { ReplyPreview } from "@/app/messages/_components/ReplyPreview";
import { TypingIndicator } from "@/components/messages/TypingIndicator";
import { GroupInfoPanel } from "@/app/messages/_components/GroupInfoPanel";
import {
  editMessageText,
  fetchConversationHeader,
  fetchConversationMessages,
  fetchMemberReadMap,
  fetchPinnedMessages,
  markConversationRead,
  pinMessage,
  softDeleteMessage,
  toggleReaction,
  updateMessageMetadata,
} from "@/lib/messages/api";
import { profileToSender } from "@/lib/messages/mappers";
import { ensureRealtimeAuth } from "@/lib/messages/ensureRealtimeAuth";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Message } from "@/lib/types/messages";

type Props = { conversationId: string };

export function ConversationView({ conversationId }: Props) {
  const { tx } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [header, setHeader] = useState<{
    title: string;
    subtitle?: string;
    type?: string;
    id?: string;
    chrome?: "messages" | "login" | "chat";
  } | null>(null);
  const [readMap, setReadMap] = useState<Map<string, string>>(new Map());
  const [readerProfiles, setReaderProfiles] = useState<
    Map<string, { id: string; displayName: string; avatarUrl?: string | null }>
  >(new Map());
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const lastMessageIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setHeader({ title: "", chrome: "messages" });
      return;
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id ?? null;
      setUserId(uid);
      if (!uid) {
        setHeader({ title: "", chrome: "login" });
        return;
      }

      const [msgs, pinned, head] = await Promise.all([
        fetchConversationMessages(supabase, conversationId),
        fetchPinnedMessages(supabase, conversationId),
        fetchConversationHeader(supabase, conversationId, uid),
      ]);
      setMessages(msgs);
      setPinnedMessages(pinned);
      setHeader(
        head
          ? { title: head.title, subtitle: head.subtitle, type: head.type, id: head.id }
          : { title: "", chrome: "chat" },
      );
      const reads = await fetchMemberReadMap(supabase, conversationId);
      setReadMap(reads);
      const readerIds = [...reads.keys()].filter((id) => id !== uid);
      if (readerIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", readerIds);
        setReaderProfiles(
          new Map(
            (profs ?? []).map((p) => {
              const s = profileToSender(p);
              return [s.id, s];
            }),
          ),
        );
      }
      await markConversationRead(supabase, conversationId, uid);
      const newest = msgs.at(-1)?.id ?? null;
      if (newest !== lastMessageIdRef.current) {
        lastMessageIdRef.current = newest;
        scrollToBottom();
      }
    } catch (e) {
      console.error("ConversationView load", e);
      setHeader({ title: "", chrome: "chat" });
    }
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    const channel = client
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          if (!cancelled) void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const row = payload.new as { conversation_id?: string } | null;
          if (row?.conversation_id === conversationId && !cancelled) void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        () => {
          if (!cancelled) void load();
        },
      )
      .subscribe();

    void ensureRealtimeAuth(client);

    const poll = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") void load();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [conversationId, load]);

  const handleReact = async (messageId: string, emoji: string) => {
    if (!supabase || !userId) return;
    await toggleReaction(supabase, messageId, userId, emoji);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const has = m.reactions.some((r) => r.userId === userId && r.emoji === emoji);
        const reactions = has
          ? m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji))
          : [
              ...m.reactions,
              {
                messageId,
                userId,
                emoji,
                createdAt: new Date().toISOString(),
              },
            ];
        return { ...m, reactions };
      }),
    );
  };

  const handlePin = async (messageId: string) => {
    if (!supabase || !userId) return;
    const ok = await pinMessage(supabase, messageId, userId, conversationId);
    if (ok) {
      const pinned = await fetchPinnedMessages(supabase, conversationId);
      setPinnedMessages(pinned);
    }
  };

  const handleEdit = async (message: Message) => {
    if (!supabase) return;
    const next = window.prompt(tx("メッセージを編集", "Edit message"), message.content ?? "");
    if (next === null) return;
    const ok = await editMessageText(supabase, message.id, next.trim());
    if (ok) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, content: next.trim(), isEdited: true } : m,
        ),
      );
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!supabase) return;
    const ok = await softDeleteMessage(supabase, messageId);
    if (ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: undefined } : m)),
      );
    }
  };

  const jumpToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getReadBy = (message: Message) => {
    const readers: Array<{ id: string; displayName: string; avatarUrl?: string | null }> = [];
    readMap.forEach((lastRead, uid) => {
      if (uid === message.senderId) return;
      if (new Date(lastRead) >= new Date(message.createdAt)) {
        const p = readerProfiles.get(uid);
        if (p) readers.push(p);
      }
    });
    return readers;
  };

  const handleTranslate = async (message: Message) => {
    if (!message.content?.trim()) return;
    const res = await fetch("/api/messages/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.content, mode: "translate" }),
    });
    const json = (await res.json()) as { result?: string };
    if (json.result) window.alert(json.result);
  };

  const handleCollabRespond = async (message: Message, status: "accepted" | "declined") => {
    if (!supabase) return;
    const meta = { ...(message.metadata as Record<string, unknown>), status };
    const ok = await updateMessageMetadata(supabase, message.id, meta);
    if (ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, metadata: meta } : m)),
      );
    }
  };

  const chatContext = messages
    .slice(-6)
    .map((m) => m.content)
    .filter(Boolean)
    .join("\n");

  if (!header) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-400">
        {tx("読み込み中...", "Loading…")}
      </div>
    );
  }

  const headerTitle =
    header.chrome === "messages"
      ? tx("メッセージ", "Messages")
      : header.chrome === "login"
        ? tx("ログインが必要です", "Sign in required")
        : header.chrome === "chat"
          ? tx("チャット", "Chat")
          : header.title;

  if (!userId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[#fafaf8]">
        <ConversationHeader title={headerTitle} />
        <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-zinc-500">
          <a href="/login" className="font-medium text-violet-600 underline">
            {tx("ログイン", "Log in")}
          </a>
          {tx("するとチャットが使えます", " to use chat")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafaf8]">
      <ConversationHeader
        title={headerTitle}
        subtitle={header.subtitle}
        onTitleClick={
          header.type === "group" || header.type === "project"
            ? () => setShowGroupInfo(true)
            : undefined
        }
      />

      {toast ? (
        <div className="bg-violet-600 px-3 py-2 text-center text-xs text-white">{toast}</div>
      ) : null}

      <PinnedMessages messages={pinnedMessages} onJump={jumpToMessage} />

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.map((message, i) => (
          <div key={message.id} id={`msg-${message.id}`}>
            <MessageBubble
              message={message}
              prevMessage={messages[i - 1]}
              currentUserId={userId}
              readBy={getReadBy(message)}
              onReply={() => setReplyTo(message)}
              onReact={(emoji) => void handleReact(message.id, emoji)}
              onPin={() => void handlePin(message.id)}
              onEdit={() => void handleEdit(message)}
              onDelete={() => void handleDelete(message.id)}
              onTranslate={() => void handleTranslate(message)}
              onCollabRespond={(status) => void handleCollabRespond(message, status)}
            />
          </div>
        ))}
        <TypingIndicator conversationId={conversationId} currentUserId={userId} />
      </div>

      {replyTo ? <ReplyPreview message={replyTo} onCancel={() => setReplyTo(null)} /> : null}

      {userId ? (
        <MessageInput
          conversationId={conversationId}
          senderId={userId}
          senderName={
            messages.find((m) => m.senderId === userId)?.sender.displayName ?? tx("あなた", "You")
          }
          replyTo={replyTo}
          chatContext={chatContext}
          onSent={(msg) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
          }}
          onSendComplete={() => setReplyTo(null)}
          onScheduled={() => {
            setToast(tx("メッセージを予約しました", "Message scheduled"));
            setTimeout(() => setToast(null), 3000);
          }}
        />
      ) : null}

      {showGroupInfo ? (
        <GroupInfoPanel
          conversationId={conversationId}
          title={header.title}
          onClose={() => setShowGroupInfo(false)}
        />
      ) : null}
    </div>
  );
}
