"use client";

import { ChevronLeft, ImagePlus, Search, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { uploadProjectImage, validateProjectImageFile } from "@/lib/projects/uploadProjectImage";
import { supabase } from "@/lib/supabase";
import { ensureRealtimeAuth } from "@/lib/messages/ensureRealtimeAuth";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** 統合メッセージ（グループ / 個別DM 共通で扱う正規化形） */
type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string | null;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
};

type TalkKind = "group" | { peerId: string };

const LINE_GREEN = "#06C755";

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || msg.includes("attachment_url");
}

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || msg.includes("does not exist");
}

function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatBubbleTime(iso: string, localeTag: string): string {
  return new Date(iso).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  const today = startOfDay(new Date().toISOString());
  const that = startOfDay(iso);
  const oneDay = 86_400_000;
  if (that === today) return locale === "en" ? "Today" : "今日";
  if (that === today - oneDay) return locale === "en" ? "Yesterday" : "昨日";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatListTime(iso: string, locale: "ja" | "en"): string {
  const d = new Date(iso);
  const today = startOfDay(new Date().toISOString());
  const that = startOfDay(iso);
  const oneDay = 86_400_000;
  const tag = locale === "en" ? "en-US" : "ja-JP";
  if (that === today) return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
  if (that === today - oneDay) return locale === "en" ? "Yesterday" : "昨日";
  return d.toLocaleDateString(tag, { month: "numeric", day: "numeric" });
}

function previewText(m: ChatMessage | undefined, photoLabel: string): string {
  if (!m) return "";
  if (m.attachmentUrl && (!m.body || m.body === "（画像）")) return photoLabel;
  return m.body;
}

function Avatar({ userId, name, url, size = 40 }: { userId?: string; name: string; url?: string | null; size?: number }) {
  const src = resolveMemberAvatarUrl(userId, url);
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-rose-300 to-indigo-400 text-sm font-bold uppercase text-white"
      aria-hidden
    >
      {initial}
    </div>
  );
}

export default function WorkspaceChat() {
  const { tx, locale } = useI18n();
  const { projectId, project, loading, uid, canEdit } = useProjectWorkspace();
  const photoLabel = tx("📷 写真", "📷 Photo");

  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const [dmAvailable, setDmAvailable] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);

  const [activeTalk, setActiveTalk] = useState<TalkKind | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const members = project?.members ?? [];
  const memberById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl?: string }>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);
  const peers = useMemo(() => members.filter((m) => m.id !== uid), [members, uid]);

  const loadMessages = useCallback(async () => {
    if (!supabase || !uid) return;
    const client = supabase;

    const groupRes = await client
      .from("project_chat_messages")
      .select("id,sender_id,body,attachment_url,created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(400);
    if (groupRes.error) {
      setErr(groupRes.error.message);
    } else {
      setGroupMessages(
        (groupRes.data ?? []).map((r) => ({
          id: r.id as string,
          senderId: r.sender_id as string,
          receiverId: null,
          body: (r.body as string) ?? "",
          attachmentUrl: (r.attachment_url as string | null) ?? null,
          createdAt: r.created_at as string,
        })),
      );
    }

    const dmQuery = (cols: string) =>
      client
        .from("project_direct_messages")
        .select(cols)
        .eq("project_id", projectId)
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
        .order("created_at", { ascending: true })
        .limit(600);

    let dmRows: Record<string, unknown>[] | null = null;
    let dmError: { message?: string; code?: string } | null = null;
    const withAttachment = await dmQuery("id,sender_id,receiver_id,body,attachment_url,created_at");
    if (withAttachment.error && isMissingColumn(withAttachment.error)) {
      const withoutAttachment = await dmQuery("id,sender_id,receiver_id,body,created_at");
      dmRows = (withoutAttachment.data as Record<string, unknown>[] | null) ?? null;
      dmError = withoutAttachment.error;
    } else {
      dmRows = (withAttachment.data as Record<string, unknown>[] | null) ?? null;
      dmError = withAttachment.error;
    }

    if (dmError) {
      setDmAvailable(!isMissingTable(dmError));
      setDirectMessages([]);
    } else {
      setDmAvailable(true);
      setDirectMessages(
        (dmRows ?? []).map((r) => ({
          id: r.id as string,
          senderId: r.sender_id as string,
          receiverId: (r.receiver_id as string | null) ?? null,
          body: (r.body as string) ?? "",
          attachmentUrl: (r.attachment_url as string | null) ?? null,
          createdAt: r.created_at as string,
        })),
      );
    }
    setChatLoading(false);
  }, [projectId, uid]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!supabase || !uid) return;
    const client = supabase;
    let cancelled = false;
    void ensureRealtimeAuth(client);
    const channel = client
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_chat_messages", filter: `project_id=eq.${projectId}` },
        () => {
          if (!cancelled) void loadMessages();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_direct_messages", filter: `project_id=eq.${projectId}` },
        () => {
          if (!cancelled) void loadMessages();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_chat_messages" },
        () => {
          if (!cancelled) void loadMessages();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_direct_messages" },
        () => {
          if (!cancelled) void loadMessages();
        },
      )
      .subscribe();
    const poll = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") void loadMessages();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [projectId, uid, loadMessages]);

  /** ペアごとの最新DM */
  const lastDmByPeer = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of directMessages) {
      const peerId = m.senderId === uid ? m.receiverId : m.senderId;
      if (!peerId) continue;
      const prev = map.get(peerId);
      if (!prev || new Date(m.createdAt) > new Date(prev.createdAt)) map.set(peerId, m);
    }
    return map;
  }, [directMessages, uid]);

  const lastGroup = groupMessages[groupMessages.length - 1];

  const talkRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dmRows = peers
      .map((p) => ({ peer: p, last: lastDmByPeer.get(p.id) }))
      .sort((a, b) => {
        const ta = a.last ? new Date(a.last.createdAt).getTime() : 0;
        const tb = b.last ? new Date(b.last.createdAt).getTime() : 0;
        return tb - ta;
      });
    if (!q) return dmRows;
    return dmRows.filter(
      (r) => r.peer.name.toLowerCase().includes(q) || previewText(r.last, photoLabel).toLowerCase().includes(q),
    );
  }, [peers, lastDmByPeer, search, photoLabel]);

  const activeMessages = useMemo(() => {
    if (activeTalk === "group") return groupMessages;
    if (activeTalk && typeof activeTalk === "object") {
      const peerId = activeTalk.peerId;
      return directMessages.filter(
        (m) =>
          (m.senderId === uid && m.receiverId === peerId) ||
          (m.senderId === peerId && m.receiverId === uid),
      );
    }
    return [];
  }, [activeTalk, groupMessages, directMessages, uid]);

  useEffect(() => {
    if (!activeTalk) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [activeTalk, activeMessages.length]);

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    const validation = validateProjectImageFile(file);
    if (validation) {
      setErr(validation);
      e.target.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErr("");
  }

  function openTalk(talk: TalkKind) {
    setActiveTalk(talk);
    setDraft("");
    setErr("");
    clearImage();
  }

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase || !uid || !canEdit || !activeTalk) return;
    const text = draft.trim();
    if (!text && !imageFile) return;

    setSending(true);
    setErr("");
    try {
      let attachmentUrl: string | null = null;
      if (imageFile) {
        const uploaded = await uploadProjectImage(supabase, uid, "project-chat", projectId, imageFile);
        attachmentUrl = uploaded.publicUrl;
      }
      const body = text || (attachmentUrl ? "（画像）" : "");

      if (activeTalk === "group") {
        const { error } = await supabase.from("project_chat_messages").insert({
          project_id: projectId,
          sender_id: uid,
          body,
          attachment_url: attachmentUrl,
        });
        if (error) throw new Error(error.message);
      } else {
        const peerId = activeTalk.peerId;
        if (attachmentUrl) {
          const { error } = await supabase.from("project_direct_messages").insert({
            project_id: projectId,
            sender_id: uid,
            receiver_id: peerId,
            body,
            attachment_url: attachmentUrl,
          });
          if (error) {
            if (isMissingColumn(error)) {
              throw new Error(
                tx(
                  "個別チャットの画像添付を使うには apply_project_chat_upgrade.sql を実行してください。",
                  "Run apply_project_chat_upgrade.sql in Supabase to enable images in direct chat.",
                ),
              );
            }
            throw new Error(error.message);
          }
        } else {
          const { error } = await supabase.from("project_direct_messages").insert({
            project_id: projectId,
            sender_id: uid,
            receiver_id: peerId,
            body,
          });
          if (error) throw new Error(error.message);
        }
      }

      setDraft("");
      clearImage();
      await loadMessages();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : tx("送信に失敗しました", "Couldn’t send"));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return null;

  if (!uid) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
        <p className="text-sm text-[#6B7280]">{tx("チャットを使うにはログインが必要です。", "Sign in to use chat.")}</p>
        <Link href="/login" className="mt-3 inline-flex min-h-[44px] items-center rounded-md bg-[#06C755] px-4 text-sm font-semibold text-white">
          {tx("ログイン", "Sign in")}
        </Link>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
        <p className="text-sm text-[#6B7280]">{tx("プロジェクトのメンバーだけがチャットに参加できます。", "Only project members can join chat.")}</p>
        <p className="mt-2 text-xs text-[#9CA3AF]">{tx("参加申請が承認されると、ここでメンバーと会話できます。", "Once your join request is approved, you can talk with members here.")}</p>
      </div>
    );
  }

  const shellClass =
    "flex h-[min(80dvh,860px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm";

  // ============ トークルーム（会話） ============
  if (activeTalk) {
    const isGroup = activeTalk === "group";
    const peer = isGroup ? null : memberById.get(activeTalk.peerId);
    const title = isGroup ? project.name : (peer?.name ?? tx("メンバー", "Member"));
    const subtitle = isGroup
      ? tx(`グループ・${members.length}人`, `Group · ${members.length} people`)
      : tx("個別トーク", "Direct message");

    let lastDate = "";
    let lastSender = "";

    return (
      <div className={shellClass}>
        <header className="flex shrink-0 items-center gap-2 border-b border-[#E5E7EB] bg-white px-2 py-2">
          <button
            type="button"
            onClick={() => setActiveTalk(null)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#374151] transition hover:bg-[#F3F4F6]"
            aria-label={tx("トーク一覧へ戻る", "Back to chats")}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
          {isGroup ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#06C755]/12 text-[#06C755]">
              <Users className="h-5 w-5" aria-hidden />
            </div>
          ) : (
            <Avatar userId={peer?.id} name={title} url={peer?.avatarUrl} size={40} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-[#1A1A1A]">{title}</p>
            <p className="truncate text-[11px] text-[#6B7280]">{subtitle}</p>
          </div>
        </header>

        {err ? (
          <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700" role="alert">
            {err}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#7c98b8] px-3 py-3">
          {chatLoading ? (
            <p className="py-8 text-center text-sm text-white/90">{tx("メッセージを読み込み中…", "Loading messages…")}</p>
          ) : activeMessages.length === 0 ? (
            <div className="mx-auto mt-6 w-fit rounded-full bg-black/15 px-4 py-1.5 text-center text-xs text-white">
              {isGroup
                ? tx("会話を始めましょう", "Start the conversation")
                : tx(`${title}さんとの会話を始めましょう`, `Start a conversation with ${title}`)}
            </div>
          ) : (
            activeMessages.map((m) => {
              const mine = m.senderId === uid;
              const sender = memberById.get(m.senderId);
              const senderName = sender?.name ?? tx("メンバー", "Member");
              const dateKey = String(startOfDay(m.createdAt));
              const showDate = dateKey !== lastDate;
              lastDate = dateKey;
              // 連続投稿はアイコン/名前を省略（日付が変わったら再表示）
              const showMeta = !mine && isGroup && (showDate || lastSender !== m.senderId);
              lastSender = m.senderId;

              return (
                <div key={m.id}>
                  {showDate ? (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-black/15 px-3 py-1 text-[11px] font-medium text-white">
                        {formatDateSeparator(m.createdAt, locale)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`mb-1.5 flex w-full items-end gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                    {!mine && isGroup ? (
                      showMeta ? (
                        <Avatar userId={sender?.id} name={senderName} url={sender?.avatarUrl} size={32} />
                      ) : (
                        <div className="w-8 shrink-0" aria-hidden />
                      )
                    ) : null}
                    <div className={`flex max-w-[74%] flex-col ${mine ? "items-end" : "items-start"}`}>
                      {showMeta ? (
                        <span className="mb-0.5 px-1 text-[11px] font-medium text-white/95">{senderName}</span>
                      ) : null}
                      <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
                            mine ? "text-white" : "bg-white text-[#1A1A1A]"
                          }`}
                          style={mine ? { background: LINE_GREEN } : undefined}
                        >
                          {m.attachmentUrl ? (
                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachmentUrl}
                                alt=""
                                className="mb-1 max-h-56 w-full rounded-lg object-cover"
                                loading="lazy"
                              />
                            </a>
                          ) : null}
                          {m.body && m.body !== "（画像）" ? (
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          ) : null}
                        </div>
                        <span className="mb-0.5 shrink-0 text-[10px] tabular-nums text-white/85">
                          {formatBubbleTime(m.createdAt, locale === "en" ? "en-US" : "ja-JP")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} className="h-px shrink-0" aria-hidden />
        </div>

        {imagePreview ? (
          <div className="relative border-t border-[#E5E7EB] bg-white px-4 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="" className="max-h-24 rounded-lg object-cover" />
            <button
              type="button"
              className="absolute right-6 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white"
              onClick={clearImage}
            >
              {tx("取消", "Remove")}
            </button>
          </div>
        ) : null}

        <form
          className="flex shrink-0 items-end gap-2 border-t border-[#E5E7EB] bg-white p-2 sm:p-3"
          onSubmit={(e) => void sendMessage(e)}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            onChange={onImagePick}
          />
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F7F8F8] text-[#6B7280] transition hover:bg-[#E9F9EF] hover:text-[#06C755]"
            aria-label={tx("画像を添付", "Attach image")}
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
          </button>
          <textarea
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#E5E7EB] bg-[#F7F8F8] px-4 py-2.5 text-base text-[#1A1A1A] outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20 sm:text-sm"
            placeholder={tx("メッセージを入力…", "Message")}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if ((draft.trim() || imageFile) && !sending) void sendMessage();
              }
            }}
            disabled={sending}
          />
          <button
            type="submit"
            className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-white transition disabled:opacity-40"
            style={{ background: LINE_GREEN }}
            disabled={sending || (!draft.trim() && !imageFile)}
            aria-label={tx("送信", "Send")}
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </form>
      </div>
    );
  }

  // ============ トーク一覧 ============
  return (
    <div className={shellClass}>
      <header className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{tx("トーク", "Chat")}</h2>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">
          {tx("グループ全体とメンバー個別のトークをまとめました", "Group chat and direct messages in one place")}
        </p>
      </header>

      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-[#F1F3F5] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
          <input
            placeholder={tx("メンバーを検索", "Search members")}
            className="flex-1 bg-transparent text-sm text-[#1A1A1A] outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {err ? (
        <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700" role="alert">
          {err}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* グループ全体（常に先頭・固定） */}
        <button
          type="button"
          onClick={() => openTalk("group")}
          className="flex w-full items-center gap-3 border-b border-[#F1F3F5] px-4 py-3 text-left transition hover:bg-[#F7F8F8] active:bg-[#F1F3F5]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#06C755]/12 text-[#06C755]">
            <Users className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[14px] font-semibold text-[#1A1A1A]">
                {project.name}{tx("（グループ全体）", " (group)")}
              </span>
              {lastGroup ? (
                <span className="shrink-0 text-[11px] text-[#9CA3AF]">{formatListTime(lastGroup.createdAt, locale)}</span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
              {lastGroup
                ? `${memberById.get(lastGroup.senderId)?.name ?? tx("メンバー", "Member")}: ${previewText(lastGroup, photoLabel)}`
                : tx(`${members.length}人のメンバー全員のトーク`, `Chat with all ${members.length} members`)}
            </p>
          </div>
        </button>

        {chatLoading ? (
          <p className="px-4 py-8 text-center text-sm text-[#9CA3AF]">{tx("読み込み中…", "Loading…")}</p>
        ) : (
          <>
            {!dmAvailable ? (
              <p className="px-4 py-3 text-[12px] leading-relaxed text-amber-800">
                {tx(
                  "個別トークを使うには Supabase で apply_project_chat_upgrade.sql を実行してください。グループ全体トークはそのまま使えます。",
                  "To use direct messages, run apply_project_chat_upgrade.sql in Supabase. Group chat still works.",
                )}
              </p>
            ) : null}
            {talkRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                {peers.length === 0
                  ? tx("まだ他のメンバーがいません", "No other members yet")
                  : tx("該当するメンバーがいません", "No matching members")}
              </p>
            ) : (
              talkRows.map(({ peer, last }) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => openTalk({ peerId: peer.id })}
                  className="flex w-full items-center gap-3 border-b border-[#F1F3F5] px-4 py-3 text-left transition hover:bg-[#F7F8F8] active:bg-[#F1F3F5]"
                >
                  <Avatar userId={peer.id} name={peer.name} url={peer.avatarUrl} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-[#1A1A1A]">{peer.name}</span>
                      {last ? (
                        <span className="shrink-0 text-[11px] text-[#9CA3AF]">{formatListTime(last.createdAt, locale)}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
                      {last ? previewText(last, photoLabel) : tx("トークを始める", "Start a chat")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
