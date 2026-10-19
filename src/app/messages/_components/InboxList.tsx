"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ja, enUS } from "date-fns/locale";
import { FolderKanban, Search, Users } from "lucide-react";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { ProjectNoticeBell } from "@/components/projects/ProjectNoticeBell";
import { FollowingChatEntry } from "@/app/messages/_components/FollowingChatEntry";
import { FollowingChatPicker } from "@/app/messages/_components/FollowingChatPicker";
import {
  ensureMyProjectConversations,
  ensureProjectScopedMail,
  fetchInboxConversations,
} from "@/lib/messages/api";
import { ensureRealtimeAuth } from "@/lib/messages/ensureRealtimeAuth";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { loadFollowingListRecent } from "@/lib/profile/followActions";
import type { FollowListUser } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import type { InboxConversation } from "@/lib/types/messages";

type InboxFilter = "all" | "unread" | "groups" | "projects";

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

const PROJECT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function InboxList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, tx } = useI18n();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowingPicker, setShowFollowingPicker] = useState(false);
  const [recentFollowing, setRecentFollowing] = useState<FollowListUser[]>([]);
  const [projectPeerIds, setProjectPeerIds] = useState<Set<string>>(new Set());
  const [scopedMemberOk, setScopedMemberOk] = useState(false);
  const peerHandledRef = useRef<string | null>(null);

  const scopedProjectId = (() => {
    const raw = searchParams.get("project")?.trim() ?? "";
    return PROJECT_UUID_RE.test(raw) ? raw : null;
  })();

  const load = useCallback(async (opts?: { syncPeers?: boolean }) => {
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

      // プロジェクトブロック: グループ＋メンバー1:1を揃える
      // プロフィールブロック: やりとり済みの相手だけ表示（空の相互フォローDMは自動作成しない）
      if (opts?.syncPeers !== false) {
        if (scopedProjectId) {
          try {
            await ensureProjectScopedMail(supabase, uid, scopedProjectId);
          } catch (e) {
            console.warn("ensureProjectScopedMail", e);
          }
        } else {
          try {
            await ensureMyProjectConversations(supabase, uid);
          } catch (e) {
            console.warn("ensureMyProjectConversations", e);
          }
        }
      }

      if (!scopedProjectId) {
        try {
          const following = await loadFollowingListRecent(supabase, uid, 8);
          setRecentFollowing(following);
        } catch (e) {
          console.warn("loadFollowingListRecent", e);
          setRecentFollowing([]);
        }
      } else {
        setRecentFollowing([]);
      }

      if (scopedProjectId) {
        const [{ data: project }, { data: ownedCheck }, { data: memCheck }, { data: memberRows }] =
          await Promise.all([
            supabase.from("projects").select("id, name, owner_id").eq("id", scopedProjectId).maybeSingle(),
            supabase.from("projects").select("id").eq("id", scopedProjectId).eq("owner_id", uid).maybeSingle(),
            supabase
              .from("project_members")
              .select("project_id")
              .eq("project_id", scopedProjectId)
              .eq("user_id", uid)
              .maybeSingle(),
            supabase.from("project_members").select("user_id").eq("project_id", scopedProjectId),
          ]);
        const isMember = Boolean(ownedCheck || memCheck);
        setScopedMemberOk(Boolean(project && isMember));
        if (project && isMember) {
          const peers = new Set<string>();
          const ownerId = project.owner_id as string | null;
          if (ownerId && ownerId !== uid) peers.add(ownerId);
          for (const row of memberRows ?? []) {
            const mid = row.user_id as string;
            if (mid && mid !== uid) peers.add(mid);
          }
          setProjectPeerIds(peers);
        } else {
          setProjectPeerIds(new Set());
        }
      } else {
        setScopedMemberOk(false);
        setProjectPeerIds(new Set());
      }

      const rows = await fetchInboxConversations(supabase, uid);
      setConversations(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setLoadError(msg.includes("conversation") ? "__db__" : msg || "__generic__");
    } finally {
      setLoading(false);
    }
  }, [scopedProjectId]);

  useEffect(() => {
    void load({ syncPeers: true });
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
          if (!cancelled) void load({ syncPeers: false });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          if (!cancelled) void load({ syncPeers: false });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        () => {
          if (!cancelled) void load({ syncPeers: false });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows" },
        () => {
          // 相互フォロー成立で名前をメール一覧に出す
          if (!cancelled) void load({ syncPeers: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_members" },
        () => {
          if (!cancelled) void load({ syncPeers: true });
        },
      )
      .subscribe();

    void ensureRealtimeAuth(client);

    const poll = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") {
        void load({ syncPeers: true });
      }
    }, 8000);

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
    if (scopedProjectId && scopedMemberOk) {
      // プロジェクトブロック: そのプロジェクトのグループ + メンバーとの 1:1 のみ
      list = list.filter((c) => {
        if (c.type === "project") return c.projectId === scopedProjectId;
        if (c.type === "direct" && c.otherUser?.id) return projectPeerIds.has(c.otherUser.id);
        return false;
      });
    } else if (!scopedProjectId) {
      // プロフィールブロック: やりとり済みの 1:1 + グループ／プロジェクト
      list = list.filter((c) => {
        if (c.type === "direct") return Boolean(c.lastMessage);
        return c.type === "group" || c.type === "project";
      });
    }
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (filter === "groups") list = list.filter((c) => c.type === "group");
    if (filter === "projects") list = list.filter((c) => c.type === "project");
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const title =
          c.type === "direct" ? (c.otherUser?.displayName ?? "") : (c.name ?? "");
        return title.toLowerCase().includes(q) || lastMessagePreview(c, locale).toLowerCase().includes(q);
      });
    }
    // プロジェクトスコープではグループを常に最上段。そのほかは未読優先→直近順
    list.sort((a, b) => {
      if (scopedProjectId) {
        if (a.type === "project" && b.type !== "project") return -1;
        if (b.type === "project" && a.type !== "project") return 1;
      }
      const aUnread = a.unreadCount > 0 ? 1 : 0;
      const bUnread = b.unreadCount > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return list;
  }, [conversations, filter, searchQuery, locale, scopedProjectId, scopedMemberOk, projectPeerIds]);

  const emptyHint = (() => {
    if (scopedProjectId && scopedMemberOk) {
      return tx(
        "グループチャットとメンバーとの個別チャットがここに表示されます。",
        "Group chat and member DMs appear here.",
      );
    }
    if (filter === "projects") {
      return tx(
        "プロジェクトのグループチャットはまだありません。参加中のプロジェクトがあれば自動で表示されます。",
        "No project group chats yet. Joined projects appear here automatically.",
      );
    }
    if (filter === "unread") {
      return tx("未読のトークはありません。", "No unread chats.");
    }
    if (filter === "groups") {
      return tx("グループトークはまだありません。", "No group chats yet.");
    }
    return tx(
      "まだトークがありません。上の「フォロー中の人とチャット」から始められます。",
      "No chats yet. Start from “Chat with people you follow” above.",
    );
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-bottom-nav">
      <div className="mobile-sticky-header mobile-content-inset">
        <AppBrandHeader
          bare
          className="py-1"
          right={userId ? <ProjectNoticeBell userId={userId} /> : null}
        />
      </div>

      <div className="border-b px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            placeholder={
              scopedProjectId
                ? tx("メンバー・グループを検索", "Search members or group")
                : tx("検索", "Search")
            }
            className="flex-1 bg-transparent text-sm outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!scopedProjectId ? (
        <div className="border-b px-4 py-2">
          <label className="sr-only" htmlFor="inbox-filter">
            {tx("フィルタ", "Filter")}
          </label>
          <select
            id="inbox-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as InboxFilter)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[15px] text-zinc-800"
          >
            <option value="all">{tx("すべて", "All")}</option>
            <option value="unread">{tx("未読", "Unread")}</option>
            <option value="projects">{tx("プロジェクトグループ", "Project groups")}</option>
            <option value="groups">{tx("グループ", "Groups")}</option>
          </select>
        </div>
      ) : null}

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
        ) : (
          <>
            {!scopedProjectId ? (
              <FollowingChatEntry
                recentFollowing={recentFollowing}
                onOpen={() => setShowFollowingPicker(true)}
              />
            ) : null}
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">{emptyHint}</p>
            ) : (
              filtered.map((conv) => <ConversationRow key={conv.id} conversation={conv} />)
            )}
          </>
        )}
      </div>

      {showFollowingPicker && userId ? (
        <FollowingChatPicker
          currentUserId={userId}
          onClose={() => setShowFollowingPicker(false)}
          onOpened={() => {
            setShowFollowingPicker(false);
            void load({ syncPeers: false });
          }}
        />
      ) : null}
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: InboxConversation }) {
  const router = useRouter();
  const { locale, tx } = useI18n();
  const isUnread = conversation.unreadCount > 0;
  const title =
    conversation.type === "direct"
      ? (conversation.otherUser?.displayName ?? tx("ユーザー", "User"))
      : (conversation.name ?? tx("グループ", "Group"));

  const open = () => {
    // 未読でも確実に遷移（preventDefault しない単純遷移）
    router.push(`/messages/${conversation.id}`);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="relative mr-3 shrink-0">
        {conversation.type === "direct" && conversation.otherUser ? (
          <MemberAvatarBubble
            userId={conversation.otherUser.id}
            name={conversation.otherUser.displayName}
            avatarUrl={conversation.otherUser.avatarUrl}
            size="md"
          />
        ) : conversation.type === "project" ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            {conversation.iconEmoji && conversation.iconEmoji !== "📁" ? (
              <span className="text-2xl">{conversation.iconEmoji}</span>
            ) : (
              <FolderKanban className="h-6 w-6" aria-hidden />
            )}
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-700">
            {conversation.iconEmoji && conversation.iconEmoji !== "💬" ? (
              <span className="text-2xl">{conversation.iconEmoji}</span>
            ) : (
              <Users className="h-6 w-6" aria-hidden />
            )}
          </div>
        )}
        {isUnread ? (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold leading-none text-white"
            aria-label={tx(`未読 ${conversation.unreadCount}件`, `${conversation.unreadCount} unread`)}
          >
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={`truncate text-sm ${
                isUnread ? "font-bold text-zinc-900" : "font-medium text-zinc-800"
              }`}
            >
              {title}
            </span>
            {conversation.type === "project" ? (
              <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                {tx("プロジェクト", "Project")}
              </span>
            ) : null}
          </span>
          <span className="ml-2 shrink-0 text-xs text-zinc-400">
            {safeTimeAgo(conversation.lastMessageAt, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`truncate text-xs ${isUnread ? "font-medium text-zinc-900" : "text-zinc-500"}`}>
            {lastMessagePreview(conversation, locale)}
          </span>
        </div>
      </div>
    </button>
  );
}
