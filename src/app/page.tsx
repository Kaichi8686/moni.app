"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type AppRole = "child" | "parent" | "investor";
type FeaturePage = "article" | "mentor" | "matching" | "programming" | "pitch" | "chat" | "account";

type Article = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
};

type Pitch = {
  id: string;
  title: string;
  body: string;
  likes: number;
};

type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  caption: string;
  imageUrl: string;
  /** Storage object path（Supabase 時のみ。削除時に使用） */
  storagePath?: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
};

type ChatMessage = {
  id: string;
  sender: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  createdAtIso: string;
};

type PresenceState = Record<string, Array<{ name?: string }>>;
type MatchMember = { id?: string; name: string; goal: string; strength: string };

type MentorChatMessage = { id: string; role: "user" | "assistant"; content: string };

const MENTOR_WELCOME_TEXT =
  "こんにちは。なんでも気軽に送ってみてください。雑談でも相談でも、そのままの言葉で大丈夫です。";

function createMentorWelcomeMessage(): MentorChatMessage {
  return { id: "mentor-welcome", role: "assistant", content: MENTOR_WELCOME_TEXT };
}

type DmPeerRow = { room_id: string; peer_id: string; peer_name: string };
type TalkRoomMeta = { previewText: string; timeLabel: string; unread: number };

function sortPeerIds(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function makeDmRoomId(uidA: string, uidB: string): string {
  const [x, y] = sortPeerIds(uidA, uidB);
  return `dm|${x}|${y}`;
}

/** 日本語はスペースなしでも1語として扱えるよう、区切りが無ければ全文を1キーワードにする */
function matchingKeywords(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t.split(/[\s、。,.，．]+/).filter(Boolean);
  return parts.length > 0 ? parts : [t];
}

/** LIKE の % _ をユーザー入力から除く（パターン破壊・意図しないワイルドカード防止） */
function sanitizeLikeTerm(term: string): string {
  return term.replace(/%/g, "").replace(/_/g, "").trim();
}

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 45) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

const pageTaglines: Record<FeaturePage, string> = {
  article: "タイムラインでシェア、記事もチェックしよう",
  mentor: "相談も雑談も、ペースはあなたのままで",
  matching: "目標が近い仲間を見つけてみよう",
  programming: "コードを試してアイデアを形に",
  pitch: "想いをピッチにして届けよう",
  chat: "広場のトークと、あなた専用のルーム",
  account: "ログイン・ロール・プロフィールの設定",
};

const featureItems: Array<{ key: FeaturePage; label: string; icon: string }> = [
  { key: "article", label: "ホーム", icon: "⌂" },
  { key: "mentor", label: "メンター", icon: "✦" },
  { key: "matching", label: "発見", icon: "◎" },
  { key: "programming", label: "コード", icon: "</>" },
  { key: "pitch", label: "ピッチ", icon: "▶" },
  { key: "chat", label: "メッセージ", icon: "✉" },
  { key: "account", label: "アカウント", icon: "◉" },
];

const DEMO_MEMBERS: MatchMember[] = [
  { name: "ゆい", goal: "教育アプリを作りたい", strength: "UIデザイン" },
  { name: "たくみ", goal: "学校の困りごとを解決したい", strength: "調査" },
  { name: "みさき", goal: "環境系スタートアップに興味がある", strength: "発表" },
];

const initialArticles: Article[] = [
  {
    id: "article-slot-1",
    title: "投資家インタビュー枠 #1",
    summary: "ここにインタビュー記事を掲載予定",
    status: "draft",
  },
];

const DEMO_FEED: FeedPost[] = [
  {
    id: "demo-feed-welcome",
    authorId: "demo",
    authorName: "moni",
    caption: "写真を選んでキャプションを付けて投稿してみよう。いいねはハートをタップ！",
    imageUrl:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fce7f3"/><stop offset="50%" style="stop-color:#e0e7ff"/><stop offset="100%" style="stop-color:#cffafe"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="400" y="380" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" fill="#64748b">サンプル</text><text x="400" y="430" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" fill="#94a3b8">Supabase 接続でみんなの投稿が見られます</text></svg>`,
      ),
    createdAt: new Date().toISOString(),
    likeCount: 0,
    likedByMe: false,
  },
];

export default function Home() {
  const cardClass =
    "rounded-none border border-[#e4e4ea] bg-white/95 p-5 shadow-[0_2px_20px_rgba(15,23,42,0.055)] backdrop-blur-[1px] sm:rounded-xl sm:shadow-[0_4px_24px_rgba(15,23,42,0.06)]";
  const inputClass =
    "rounded-md border border-[#dbdbdb] bg-[#fafafa] px-3 py-2 text-base text-[#262626] outline-none transition focus:border-[#a8a8a8] focus:bg-white";
  const primaryButtonClass =
    "rounded-lg bg-[#0095f6] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,149,246,0.35)] transition hover:bg-[#1877f2] hover:shadow-[0_4px_12px_rgba(0,149,246,0.4)] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
  const secondaryButtonClass =
    "rounded-lg border border-[#dbdbdb] bg-white px-3 py-2 text-sm font-semibold text-[#262626] transition hover:bg-[#fafafa] active:bg-[#efefef]";
  const bottomNavButtonClass = (page: FeaturePage) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] leading-tight transition ${
      activePage === page ? "font-semibold text-[#262626]" : "font-normal text-[#8e8e8e]"
    }`;

  const [role, setRole] = useState<AppRole>("child");
  const [activePage, setActivePage] = useState<FeaturePage>("article");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileGoal, setProfileGoal] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");

  const [mentorMessages, setMentorMessages] = useState<MentorChatMessage[]>(() => [
    createMentorWelcomeMessage(),
  ]);
  const [mentorInput, setMentorInput] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorError, setMentorError] = useState("");
  const mentorScrollAnchorRef = useRef<HTMLDivElement>(null);
  const chatScrollAnchorRef = useRef<HTMLDivElement>(null);

  const [matchGoal, setMatchGoal] = useState("");
  const [matches, setMatches] = useState<MatchMember[]>(DEMO_MEMBERS);
  const [matchNotice, setMatchNotice] = useState("");

  const [code, setCode] = useState(
    'const service = "moni";\nconsole.log(service + "で挑戦を始めよう");',
  );
  const [codeOutput, setCodeOutput] = useState("ここに実行結果が表示されます。");

  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSummary, setArticleSummary] = useState("");

  const [pitchTitle, setPitchTitle] = useState("");
  const [pitchBody, setPitchBody] = useState("");
  const [pitches, setPitches] = useState<Pitch[]>([]);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(() => (supabaseEnabled ? [] : DEMO_FEED));
  const [postCaption, setPostCaption] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postUploadPreview, setPostUploadPreview] = useState<string | null>(null);
  const [postPosting, setPostPosting] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  const [chatName, setChatName] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [callRoom, setCallRoom] = useState("");
  const [callUrl, setCallUrl] = useState("");
  /** LINE のトーク一覧 ↔ 個別トーク */
  const [chatSubView, setChatSubView] = useState<"list" | "room">("list");
  const [activeRoomId, setActiveRoomId] = useState("global");
  const [dmPeers, setDmPeers] = useState<DmPeerRow[]>([]);
  const [talkMeta, setTalkMeta] = useState<Record<string, TalkRoomMeta>>({});

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const canUseSupabase = useMemo(() => Boolean(supabase && supabaseEnabled), []);
  const requiresLogin = canUseSupabase && !session;

  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const loadRole = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("role,display_name,goal")
      .eq("id", userId)
      .maybeSingle();
    if (error) return;
    if (data?.role === "child" || data?.role === "parent" || data?.role === "investor") {
      setRole(data.role);
    }
    setDisplayName((data?.display_name as string | null) ?? "");
    setProfileGoal((data?.goal as string | null) ?? "");
    if (typeof data?.display_name === "string" && data.display_name.trim()) {
      setChatName(data.display_name);
    }
  }, []);

  async function saveRole(nextRole: AppRole) {
    setRole(nextRole);
    if (!supabase || !session) return;
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      role: nextRole,
      display_name: displayName || session.user.email || "user",
      goal: profileGoal,
    });
    if (error) {
      setAuthMessage(`ロール保存に失敗: ${error.message}`);
    }
  }

  async function saveProfile() {
    if (!supabase || !session) return;
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      role,
      display_name: displayName || session.user.email || "user",
      goal: profileGoal,
    });
    if (error) {
      setAuthMessage(`プロフィール保存に失敗: ${error.message}`);
      return;
    }
    setAuthMessage("プロフィールを保存しました。");
    if (displayName.trim()) setChatName(displayName.trim());
  }

  const loadArticles = useCallback(async () => {
    if (!supabase) return;
    let query = supabase
      .from("articles")
      .select("id,title,summary,status")
      .order("created_at", { ascending: false });
    if (role !== "investor") query = query.eq("status", "published");
    const { data, error } = await query;
    if (error) {
      setAuthMessage(`記事の取得に失敗: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setArticles(initialArticles);
      return;
    }
    setArticles(data as Article[]);
  }, [role]);

  const loadPitches = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("pitches")
      .select("id,title,body,likes")
      .order("created_at", { ascending: false });
    if (error) {
      setAuthMessage(`ピッチの取得に失敗: ${error.message}`);
      return;
    }
    setPitches((data as Pitch[]) ?? []);
  }, []);

  const loadPosts = useCallback(async () => {
    if (!supabaseEnabled || !supabase) {
      setFeedPosts(DEMO_FEED);
      return;
    }
    const client = supabase;
    const uid = sessionRef.current?.user.id ?? null;
    const { data: rows, error } = await client
      .from("posts")
      .select("id,author_id,caption,image_path,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) {
      const hint = `${error.message}${error.code ? ` (${error.code})` : ""}`;
      if (
        hint.includes("does not exist") ||
        hint.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        setFeedPosts(DEMO_FEED);
        return;
      }
      setAuthMessage(`投稿の取得に失敗: ${error.message}`);
      return;
    }
    if (!rows?.length) {
      setFeedPosts([]);
      return;
    }
    const authorIds = [...new Set(rows.map((r) => r.author_id as string))];
    const { data: profs } = await client.from("profiles").select("id,display_name").in("id", authorIds);
    const nameById = new Map(
      (profs ?? []).map((p) => [
        p.id as string,
        ((p.display_name as string | null)?.trim() || "ユーザー") as string,
      ]),
    );
    const postIds = rows.map((r) => r.id as string);
    const { data: likesRows } = await client.from("post_likes").select("post_id,user_id").in("post_id", postIds);
    const countByPost = new Map<string, number>();
    const likedSet = new Set<string>();
    for (const lr of likesRows ?? []) {
      const pid = lr.post_id as string;
      countByPost.set(pid, (countByPost.get(pid) ?? 0) + 1);
      if (uid && (lr.user_id as string) === uid) likedSet.add(pid);
    }
    const mapped: FeedPost[] = rows.map((r) => {
      const path = r.image_path as string;
      const { data: pub } = client.storage.from("post-images").getPublicUrl(path);
      return {
        id: r.id as string,
        authorId: r.author_id as string,
        authorName: nameById.get(r.author_id as string) || "ユーザー",
        caption: (r.caption as string) || "",
        imageUrl: pub.publicUrl,
        storagePath: path,
        createdAt: r.created_at as string,
        likeCount: countByPost.get(r.id as string) ?? 0,
        likedByMe: likedSet.has(r.id as string),
      };
    });
    setFeedPosts(mapped);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,sender_id,sender_name,body,created_at")
      .eq("room_id", activeRoomId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      setAuthMessage(`チャットの取得に失敗: ${error.message}`);
      return;
    }
    const mapped = (data ?? []).map((row) => ({
      id: row.id as string,
      sender: row.sender_name as string,
      senderId: (row.sender_id as string | null) ?? null,
      body: row.body as string,
      createdAt: new Date(row.created_at as string).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAtIso: row.created_at as string,
    }));
    setMessages(mapped);
  }, [activeRoomId, supabase]);

  const loadReadState = useCallback(
    async (userId: string, roomId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("chat_reads")
        .select("last_read_at")
        .eq("user_id", userId)
        .eq("room_id", roomId)
        .maybeSingle();
      setLastReadAt((data?.last_read_at as string | null) ?? null);
    },
    [supabase],
  );

  const refreshTalkListRef = useRef<(() => Promise<void>) | null>(null);

  const refreshTalkList = useCallback(async () => {
    const s = sessionRef.current;
    if (!supabase || !s) {
      setDmPeers([]);
      setTalkMeta({});
      return;
    }

    const { data: rooms, error: roomErr } = await supabase
      .from("chat_dm_rooms")
      .select("room_id, peer_a, peer_b");
    if (roomErr) {
      setAuthMessage(`トーク一覧の取得に失敗: ${roomErr.message}`);
      return;
    }

    const list: DmPeerRow[] = [];
    const peerIds: string[] = [];
    for (const row of rooms ?? []) {
      const pa = row.peer_a as string;
      const pb = row.peer_b as string;
      const peerId = pa === s.user.id ? pb : pa;
      peerIds.push(peerId);
      list.push({ room_id: row.room_id as string, peer_id: peerId, peer_name: "…" });
    }

    const { data: profiles } =
      peerIds.length > 0
        ? await supabase.from("profiles").select("id, display_name").in("id", peerIds)
        : { data: [] as { id: string; display_name: string | null }[] };
    const nameBy = new Map(
      (profiles ?? []).map((p) => [p.id as string, ((p.display_name as string | null) || "ユーザー") as string]),
    );
    const enriched = list.map((r) => ({ ...r, peer_name: nameBy.get(r.peer_id) || "ユーザー" }));
    setDmPeers(enriched);

    const { data: reads } = await supabase
      .from("chat_reads")
      .select("room_id, last_read_at")
      .eq("user_id", s.user.id);
    const readMap = new Map((reads ?? []).map((r) => [r.room_id as string, r.last_read_at as string]));

    const allRooms = ["global", ...enriched.map((e) => e.room_id)];
    const meta: Record<string, TalkRoomMeta> = {};
    const epoch = "1970-01-01T00:00:00.000Z";

    const formatTimeLabel = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      return isToday
        ? d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
        : `${d.getMonth() + 1}/${d.getDate()}`;
    };

    for (const rid of allRooms) {
      const { data: last } = await supabase
        .from("chat_messages")
        .select("body, created_at, sender_id")
        .eq("room_id", rid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lr = readMap.get(rid);
      let unread = 0;
      if (last) {
        const since = lr ?? epoch;
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("room_id", rid)
          .gt("created_at", since)
          .neq("sender_id", s.user.id);
        unread = count ?? 0;
      }

      const body = (last?.body as string)?.replace(/\s+/g, " ").trim() ?? "";
      const previewText = body ? (body.length > 42 ? `${body.slice(0, 42)}…` : body) : "メッセージはまだありません";
      const timeLabel = last?.created_at ? formatTimeLabel(last.created_at as string) : "";

      meta[rid] = { previewText, timeLabel, unread };
    }

    setTalkMeta(meta);
  }, [supabase]);

  refreshTalkListRef.current = refreshTalkList;

  const loadRoleRef = useRef(loadRole);
  const loadArticlesRef = useRef(loadArticles);
  const loadPitchesRef = useRef(loadPitches);
  const loadPostsRef = useRef(loadPosts);
  const loadMessagesRef = useRef(loadMessages);
  loadRoleRef.current = loadRole;
  loadArticlesRef.current = loadArticles;
  loadPitchesRef.current = loadPitches;
  loadPostsRef.current = loadPosts;
  loadMessagesRef.current = loadMessages;

  async function markChatAsRead() {
    if (!supabase || !session) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("chat_reads").upsert({
      user_id: session.user.id,
      room_id: activeRoomId,
      last_read_at: now,
    });
    if (error) {
      setAuthMessage(`既読更新に失敗: ${error.message}`);
      return;
    }
    setLastReadAt(now);
    void refreshTalkListRef.current?.();
  }

  async function openDmFromMatch(peerId: string, peerName: string) {
    if (!supabase || !session) {
      setAuthMessage("つながるにはログインが必要です。");
      return;
    }
    if (peerId === session.user.id) return;
    const roomId = makeDmRoomId(session.user.id, peerId);
    const [peer_a, peer_b] = sortPeerIds(session.user.id, peerId);
    const { error } = await supabase.from("chat_dm_rooms").insert({ room_id: roomId, peer_a, peer_b });
    if (error && error.code !== "23505") {
      setAuthMessage(`トークルームの作成に失敗: ${error.message}`);
      return;
    }
    await refreshTalkList();
    setActiveRoomId(roomId);
    setActivePage("chat");
    setChatSubView("room");
    setAuthMessage(`${peerName}さんとのトークを開きました。`);
  }

  const unreadCount = useMemo(() => {
    if (!session) return 0;
    const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    return messages.filter((msg) => {
      const msgTime = new Date(msg.createdAtIso).getTime();
      return msg.senderId !== session.user.id && msgTime > readTime;
    }).length;
  }, [lastReadAt, messages, session]);

  /** LINE の「ここから未読」用：相手の未読の先頭メッセージのインデックス */
  const firstUnreadMessageIndex = useMemo(() => {
    if (!session) return -1;
    const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    return messages.findIndex((msg) => {
      const msgTime = new Date(msg.createdAtIso).getTime();
      return msg.senderId !== session.user.id && msgTime > readTime;
    });
  }, [lastReadAt, messages, session]);

  const totalTalkUnread = useMemo(
    () => Object.values(talkMeta).reduce((s, m) => s + m.unread, 0),
    [talkMeta],
  );

  const globalTalkPreview = talkMeta.global ?? {
    previewText: "メッセージはまだありません",
    timeLabel: "",
    unread: 0,
  };

  const autoReadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase || !session) return;
    if (activePage !== "chat" || chatSubView !== "room") return;
    if (unreadCount <= 0) return;

    // トーク画面を開いているときだけ、LINE 同様しばらくしたら自動既読
    if (autoReadTimerRef.current) window.clearTimeout(autoReadTimerRef.current);
    autoReadTimerRef.current = window.setTimeout(() => {
      void markChatAsRead();
    }, 600);

    return () => {
      if (autoReadTimerRef.current) window.clearTimeout(autoReadTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, session, activePage, chatSubView]);

  useEffect(() => {
    if (typeof window === "undefined" || !supabase || !supabaseEnabled) return;
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error_description") ?? params.get("error");
    if (oauthErr) {
      setAuthMessage(`ログインエラー: ${decodeURIComponent(oauthErr.replace(/\+/g, " "))}`);
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      const next = data.session ?? null;
      sessionRef.current = next;
      setSession(next);
      setSessionEmail(next?.user.email ?? null);
      if (next) {
        await loadRoleRef.current(next.user.id);
        await loadArticlesRef.current();
        await loadPitchesRef.current();
        await refreshTalkListRef.current?.();
      }
      await loadPostsRef.current();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const next = nextSession ?? null;
      sessionRef.current = next;
      setSession(next);
      setSessionEmail(next?.user.email ?? null);
      if (next) {
        void Promise.all([
          loadRoleRef.current(next.user.id),
          loadArticlesRef.current(),
          loadPitchesRef.current(),
          refreshTalkListRef.current?.() ?? Promise.resolve(),
          loadPostsRef.current(),
        ]);
      } else {
        setMessages([]);
        setDmPeers([]);
        setTalkMeta({});
        setActiveRoomId("global");
        void loadPostsRef.current();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
    // 依存は空で1回だけ。supabase / supabaseEnabled はモジュール定数。配列長を変えない（React 19 / Fast Refresh 対策）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 認証リスナーはマウント時のみ
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    void loadMessages();
    void loadReadState(session.user.id, activeRoomId);
  }, [supabase, session, activeRoomId, loadMessages, loadReadState]);

  useEffect(() => {
    if (!canUseSupabase || !supabase || !session) return;
    const client = supabase;
    const displayName = chatName.trim() || session.user.email || "user";
    const channel = client
      .channel("chat-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          void loadMessagesRef.current();
          void refreshTalkListRef.current?.();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_dm_rooms" },
        () => {
          void refreshTalkListRef.current?.();
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        const names = Object.values(state)
          .flat()
          .map((item) => item.name || "user");
        const unique = Array.from(new Set(names));
        setOnlineUsers(unique);
      })
      .subscribe();

    void channel.track({ name: displayName });

    return () => {
      void client.removeChannel(channel);
    };
  }, [canUseSupabase, chatName, session, supabase]);

  useEffect(() => {
    if (!canUseSupabase || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("feed-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          void loadPostsRef.current();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => {
          void loadPostsRef.current();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [canUseSupabase, supabase]);

  useEffect(() => {
    return () => {
      if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    };
  }, [postUploadPreview]);

  function authRedirectUrl() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/callback`;
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setLoading(true);
    const redirectTo = authRedirectUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) setAuthMessage(error.message);
    setLoading(false);
  }

  async function signInWithEmail(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const emailRedirectTo = authRedirectUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    setAuthMessage(error ? error.message : "ログインリンクをメール送信しました。");
    setLoading(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setSessionEmail(null);
  }

  useEffect(() => {
    mentorScrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mentorMessages, mentorLoading]);

  useEffect(() => {
    if (activePage !== "chat" || chatSubView !== "room") return;
    chatScrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activePage, chatSubView]);

  async function sendMentorMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = mentorInput.trim();
    if (!text || mentorLoading) return;

    const userMsg: MentorChatMessage = {
      id: `u-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      role: "user",
      content: text,
    };
    const history = [...mentorMessages, userMsg];
    setMentorInput("");
    setMentorMessages(history);
    setMentorLoading(true);
    setMentorError("");

    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const result = (await response.json()) as { reply?: string; error?: string };
      const assistantReply = result.reply;
      if (!response.ok || assistantReply == null || assistantReply === "") {
        setMentorError(result.error ?? "AIメンターの生成に失敗しました。");
        return;
      }
      setMentorMessages((prev) => [
        ...prev,
        {
          id: `a-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
          role: "assistant",
          content: assistantReply,
        },
      ]);
    } catch {
      setMentorError("AIメンターに接続できませんでした。");
    } finally {
      setMentorLoading(false);
    }
  }

  function clearMentorChat() {
    setMentorMessages([createMentorWelcomeMessage()]);
    setMentorError("");
  }

  async function runMatching(event: FormEvent) {
    event.preventDefault();
    const terms = matchingKeywords(matchGoal).map(sanitizeLikeTerm).filter(Boolean);
    if (terms.length === 0) return;

    if (supabase && session) {
      const orParts = terms.flatMap((term) => [
        `goal.ilike.%${term}%`,
        `display_name.ilike.%${term}%`,
      ]);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,goal,role")
        .neq("id", session.user.id)
        .or(orParts.join(","))
        .limit(30);
      if (error) {
        setMatchNotice("");
        setAuthMessage(`マッチング検索に失敗: ${error.message}`);
        return;
      }
      const mapped: MatchMember[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: (row.display_name as string | null) || "ユーザー",
        goal: (row.goal as string | null) || "目標未設定",
        strength: row.role === "investor" ? "投資/事業経験" : row.role === "parent" ? "保護者視点" : "子ども起業家",
      }));
      setMatches(mapped);
      setMatchNotice(
        mapped.length === 0
          ? "条件に合うユーザーが見つかりませんでした。別の言葉で試すか、他のユーザーにプロフィールの目標が登録されているか確認してください。"
          : `${mapped.length}件見つかりました。`,
      );
      return;
    }

    const ranked = [...DEMO_MEMBERS]
      .map((m) => {
        const haystack = `${m.name}${m.goal}${m.strength}`;
        const score = terms.reduce((acc, word) => (haystack.includes(word) ? acc + 1 : acc), 0);
        return { m, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ m }) => m);
    setMatches(ranked);
    setMatchNotice(
      ranked.length === 0
        ? "デモ一覧に一致する仲間はいません。「教育」「環境」「学校」など短い言葉で試してください。"
        : `${ranked.length}件ヒット（デモデータ内検索）`,
    );
  }

  async function publishArticle(id: string, status: "draft" | "published") {
    if (!supabase || !session) return;
    const next = status === "published" ? "draft" : "published";
    const { error } = await supabase.from("articles").update({ status: next }).eq("id", id);
    if (error) {
      setAuthMessage(`記事公開状態の更新に失敗: ${error.message}`);
      return;
    }
    await loadArticles();
  }

  function runCode() {
    const logs: string[] = [];
    const customConsole = { log: (...args: unknown[]) => logs.push(args.join(" ")) };
    try {
      const fn = new Function("console", code);
      fn(customConsole);
      setCodeOutput(logs.join("\n") || "実行完了（出力なし）");
    } catch (error) {
      setCodeOutput(`エラー: ${(error as Error).message}`);
    }
  }

  async function addArticle(event: FormEvent) {
    event.preventDefault();
    if (!articleTitle || !articleSummary) return;
    if (requiresLogin) {
      setAuthMessage("投稿するにはログインしてください。");
      return;
    }
    if (supabase && session) {
      setBusy(true);
      try {
        const { error } = await supabase.from("articles").insert({
          title: articleTitle,
          summary: articleSummary,
          status: "draft",
          author_id: session.user.id,
        });
        if (error) {
          setAuthMessage(`記事投稿に失敗: ${error.message}`);
          return;
        }
        await loadArticles();
      } finally {
        setBusy(false);
      }
    } else {
      setArticles((prev) => [
        { id: `article-${Date.now()}`, title: articleTitle, summary: articleSummary, status: "draft" },
        ...prev,
      ]);
    }
    setArticleTitle("");
    setArticleSummary("");
  }

  async function addPitch(event: FormEvent) {
    event.preventDefault();
    if (!pitchTitle || !pitchBody) return;
    if (requiresLogin) {
      setAuthMessage("投稿するにはログインしてください。");
      return;
    }
    if (supabase && session) {
      setBusy(true);
      try {
        const { error } = await supabase.from("pitches").insert({
          title: pitchTitle,
          body: pitchBody,
          likes: 0,
          author_id: session.user.id,
        });
        if (error) {
          setAuthMessage(`ピッチ投稿に失敗: ${error.message}`);
          return;
        }
        await loadPitches();
      } finally {
        setBusy(false);
      }
    } else {
      setPitches((prev) => [{ id: `pitch-${Date.now()}`, title: pitchTitle, body: pitchBody, likes: 0 }, ...prev]);
    }
    setPitchTitle("");
    setPitchBody("");
  }

  function onPostFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    if (!f) {
      setPostFile(null);
      setPostUploadPreview(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setAuthMessage("画像は5MB以下にしてください。");
      e.target.value = "";
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
      setAuthMessage("JPEG / PNG / WebP / GIF の画像を選んでください。");
      e.target.value = "";
      return;
    }
    setPostFile(f);
    setPostUploadPreview(URL.createObjectURL(f));
  }

  function resetPostComposer() {
    setPostCaption("");
    setPostFile(null);
    if (postUploadPreview) URL.revokeObjectURL(postUploadPreview);
    setPostUploadPreview(null);
    if (postFileInputRef.current) postFileInputRef.current.value = "";
  }

  async function createFeedPost(event: FormEvent) {
    event.preventDefault();
    if (!postFile) {
      setAuthMessage("画像を1枚選んでください。");
      return;
    }
    if (requiresLogin) {
      setAuthMessage("投稿するにはログインしてください。");
      return;
    }
    const caption = postCaption.trim();

    if (!supabase || !session) {
      const url = URL.createObjectURL(postFile);
      setFeedPosts((prev) => [
        {
          id: `local-post-${Date.now()}`,
          authorId: "local",
          authorName: displayName.trim() || "あなた",
          caption,
          imageUrl: url,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          likedByMe: false,
        },
        ...prev,
      ]);
      resetPostComposer();
      setAuthMessage("（デモ）端末内にだけ投稿を追加しました。Supabase 接続で共有できます。");
      return;
    }

    setPostPosting(true);
    try {
      const extFromType = postFile.type === "image/png" ? "png" : postFile.type === "image/webp" ? "webp" : postFile.type === "image/gif" ? "gif" : "jpg";
      const path = `${session.user.id}/${Date.now()}.${extFromType}`;
      const { error: upErr } = await supabase.storage.from("post-images").upload(path, postFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: postFile.type || "image/jpeg",
      });
      if (upErr) {
        setAuthMessage(`画像のアップロードに失敗: ${upErr.message}`);
        return;
      }
      const { error: insErr } = await supabase.from("posts").insert({
        author_id: session.user.id,
        caption,
        image_path: path,
      });
      if (insErr) {
        setAuthMessage(`投稿の保存に失敗: ${insErr.message}`);
        await supabase.storage.from("post-images").remove([path]);
        return;
      }
      resetPostComposer();
      await loadPosts();
    } finally {
      setPostPosting(false);
    }
  }

  async function toggleFeedPostLike(post: FeedPost) {
    if (requiresLogin) {
      setAuthMessage("いいねするにはログインしてください。");
      return;
    }
    if (!supabase || !session) {
      setFeedPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: p.likedByMe ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
              }
            : p,
        ),
      );
      return;
    }
    if (post.likedByMe) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id);
      if (error) {
        setAuthMessage(`いいねの解除に失敗: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: session.user.id });
      if (error) {
        setAuthMessage(`いいねに失敗: ${error.message}`);
        return;
      }
    }
    await loadPosts();
  }

  async function deleteFeedPost(post: FeedPost) {
    if (!session || session.user.id !== post.authorId) return;
    if (!supabase || !canUseSupabase) {
      setFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (post.imageUrl.startsWith("blob:")) URL.revokeObjectURL(post.imageUrl);
      return;
    }
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      setAuthMessage(`投稿の削除に失敗: ${error.message}`);
      return;
    }
    if (post.storagePath) {
      await supabase.storage.from("post-images").remove([post.storagePath]);
    }
    await loadPosts();
  }

  async function cheerPitch(id: string, likes: number) {
    if (requiresLogin) {
      setAuthMessage("応援するにはログインしてください。");
      return;
    }
    if (supabase && session) {
      const { error } = await supabase.from("pitches").update({ likes: likes + 1 }).eq("id", id);
      if (error) {
        setAuthMessage(`応援の更新に失敗: ${error.message}`);
        return;
      }
      await loadPitches();
      return;
    }
    setPitches((prev) => prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p)));
  }

  async function addMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!chatName || !chatBody) return;
    if (requiresLogin) {
      setAuthMessage("チャット送信にはログインしてください。");
      return;
    }
    if (supabase && session) {
      const { error } = await supabase.from("chat_messages").insert({
        sender_id: session.user.id,
        sender_name: chatName,
        body: chatBody,
        room_id: activeRoomId,
      });
      if (error) {
        setAuthMessage(`チャット送信に失敗: ${error.message}`);
        return;
      }
      await loadMessages();
      void refreshTalkListRef.current?.();
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: `chat-${Date.now()}`,
          sender: chatName,
          senderId: null,
          body: chatBody,
          createdAt: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
          createdAtIso: new Date().toISOString(),
        },
      ]);
    }
    setChatBody("");
  }

  function startJitsiCall() {
    const room = `moni-${Math.random().toString(36).slice(2, 10)}`;
    const url = `https://meet.jit.si/${room}`;
    setCallRoom(room.toUpperCase());
    setCallUrl(url);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win == null) {
      setAuthMessage("新しいタブがブロックされました。画面内の通話リンクをタップして開いてください。");
    }
  }

  const storySeed = displayName.trim().charAt(0) || sessionEmail?.trim().charAt(0) || "+";
  const storyInitial = storySeed.toUpperCase();

  return (
    <div className="relative min-h-[100dvh] min-h-screen pt-[env(safe-area-inset-top,0px)] text-[#262626]">
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-gradient-to-br from-fuchsia-200/35 via-orange-100/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute right-[-10%] top-1/4 h-80 w-80 rounded-full bg-gradient-to-bl from-sky-200/30 via-indigo-100/25 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/3 left-1/3 h-56 w-56 rounded-full bg-gradient-to-tr from-amber-100/25 to-rose-100/20 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-0 px-0 py-0 sm:gap-5 sm:px-4 sm:py-4 lg:grid-cols-[260px_1fr] lg:px-6">
        <aside className="hidden border border-[#e8e8ec] bg-gradient-to-b from-white to-[#fffbf7]/90 shadow-[0_4px_24px_rgba(15,23,42,0.06)] sm:mb-0 sm:block sm:rounded-xl lg:sticky lg:top-4 lg:h-fit lg:self-start">
          <div className="flex items-center gap-3 border-b border-[#efefef] p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] from-10% via-[#e6683c] via-40% to-[#bc1888] to-90% p-[2.5px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#c7c7c7] text-lg font-bold text-white">
                  {storyInitial}
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName.trim() || "名前未設定"}</p>
              <p className="truncate text-xs text-[#8e8e8e]">{sessionEmail ?? "未ログイン"}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-[#8e8e8e]">アカウントの種類</p>
            <p className="mt-1 text-sm font-medium">
              {role === "child" ? "子ども" : role === "parent" ? "保護者" : "投資家/起業家"}
            </p>
          </div>
        </aside>

        <div className="space-y-0 sm:space-y-4">
          <header className="flex items-center justify-between gap-3 border border-[#e8e8ec] border-b-0 bg-white/90 px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-md sm:rounded-t-xl sm:border-b-0 lg:rounded-xl lg:border-b lg:border-[#e8e8ec]">
            <div className="min-w-0">
              <h1 className="bg-gradient-to-r from-[#f09433] via-[#e6683c] via-40% to-[#bc1888] to-90% bg-clip-text font-sans text-2xl font-semibold italic tracking-tight text-transparent">
                moni
              </h1>
              <p className="mt-0.5 text-[11px] font-medium tracking-wide text-[#a8a29e]">
                子ども · 保護者 · 投資家をつなぐ
              </p>
            </div>
            <div className="max-w-[55%] shrink-0 truncate text-right text-xs text-[#8e8e8e]">
              {sessionEmail ? sessionEmail : "ログイン"}
            </div>
          </header>

          <div
            className={`border-x border-[#e8e8ec] bg-gradient-to-r from-[#fffefb] via-[#faf8ff] to-[#f8fbff] px-4 py-2.5 sm:mx-0 sm:border sm:border-t-0 ${
              activePage === "article"
                ? "border-b-0 sm:rounded-none sm:border-b-0"
                : "border-b border-[#e8e8ec] sm:rounded-b-xl sm:border-b sm:border-[#e8e8ec]"
            }`}
          >
            <p className="text-center text-[12px] font-medium leading-relaxed text-[#57534e]">
              <span className="mr-1.5 inline-block opacity-90" aria-hidden>
                ✨
              </span>
              {pageTaglines[activePage]}
            </p>
          </div>

          {/* ストーリーズ（ホームのみ） */}
          {activePage === "article" ? (
          <div className="border border-[#e8e8ec] border-t-0 bg-white/95 shadow-[0_2px_16px_rgba(15,23,42,0.04)] sm:rounded-b-xl sm:border-t-0 lg:rounded-b-xl lg:border-t lg:border-[#e8e8ec]">
            <div className="flex items-center justify-between border-b border-[#f0f0f3] px-4 py-2">
              <span className="text-xs font-bold tracking-wide text-[#262626]">ストーリーズ</span>
              <span className="text-[10px] text-[#8e8e8e]">アイコンをタップでメッセージ</span>
            </div>
            <div className="flex gap-4 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] from-10% via-[#e6683c] via-40% to-[#bc1888] to-90% p-[2.5px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#c7c7c7] text-lg font-semibold text-white">
                      {storyInitial}
                    </div>
                  </div>
                </div>
                <span className="max-w-[4.5rem] truncate text-[11px] text-[#262626]">あなた</span>
              </div>
              {onlineUsers.slice(0, 14).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="flex shrink-0 flex-col items-center gap-1"
                  onClick={() => {
                    setActivePage("chat");
                    setChatSubView("list");
                  }}
                >
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] p-[2.5px]">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#262626] text-sm font-semibold text-white">
                        {(name.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <span className="max-w-[4.5rem] truncate text-[11px] text-[#262626]">{name}</span>
                </button>
              ))}
              {onlineUsers.length === 0
                ? ["tips", "仲間", "アイデア"].map((label, i) => (
                    <div key={label} className="flex shrink-0 flex-col items-center gap-1 opacity-80">
                      <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-dashed border-[#dbdbdb] bg-[#fafafa]">
                        <span className="text-[10px] font-medium text-[#8e8e8e]">{i + 1}</span>
                      </div>
                      <span className="max-w-[4.5rem] truncate text-[11px] text-[#8e8e8e]">{label}</span>
                    </div>
                  ))
                : null}
            </div>
          </div>
          ) : null}

          <main className="grid gap-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:grid-cols-1">
        <section className={`${cardClass} ${activePage === "account" ? "" : "hidden"}`}>
            <h2 className="text-base font-semibold">アカウント</h2>
            <p className="mt-1 text-xs text-[#8e8e8e]">ログイン・ロール・プロフィール</p>
            {!canUseSupabase ? (
              <p className="mt-2 text-sm text-[#ed4956]">
                Supabase未接続です。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
                `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定すると本番認証が有効になります。
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[#8e8e8e]">
                  Supabase の Authentication → URL Configuration → Redirect URLs に、次を追加してください:{" "}
                  <code className="rounded bg-[#efefef] px-1 py-0.5 text-[11px] text-[#262626]">
                    http://127.0.0.1:3002/auth/callback
                  </code>{" "}
                  と{" "}
                  <code className="rounded bg-[#efefef] px-1 py-0.5 text-[11px] text-[#262626]">
                    http://localhost:3002/auth/callback
                  </code>
                  （メール・Google 共通）
                </p>
                <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={signInWithGoogle}
                  disabled={loading || busy}
                  className={primaryButtonClass}
                  type="button"
                >
                  Googleでログイン
                </button>
                <form onSubmit={signInWithEmail} className="flex flex-wrap items-center gap-2">
                  <input
                    className={inputClass}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button className={secondaryButtonClass} type="submit" disabled={loading || busy}>
                    メールログイン
                  </button>
                </form>
                <button onClick={signOut} className={secondaryButtonClass} type="button" disabled={loading || busy}>
                  ログアウト
                </button>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={secondaryButtonClass} type="button" onClick={() => void saveRole("child")}>子ども</button>
              <button className={secondaryButtonClass} type="button" onClick={() => void saveRole("parent")}>保護者</button>
              <button className={secondaryButtonClass} type="button" onClick={() => void saveRole("investor")}>投資家/起業家</button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className={inputClass}
                placeholder="表示名（例: たろう）"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="目標（例: 教育アプリを作りたい）"
                value={profileGoal}
                onChange={(e) => setProfileGoal(e.target.value)}
              />
            </div>
            <button className={`mt-2 ${primaryButtonClass}`} type="button" onClick={() => void saveProfile()} disabled={requiresLogin}>
              プロフィールを保存
            </button>
            {authMessage ? <p className="mt-2 text-sm text-[#262626]">{authMessage}</p> : null}
            {requiresLogin ? (
              <p className="mt-2 text-sm text-[#ed4956]">
                投稿系機能を使うにはログインが必要です。メールログインの場合は、届いたリンクを開いてから保存できます。ヘッダー右のメールが表示されているか確認してください。
              </p>
            ) : null}
        </section>

        <section className={`${cardClass} overflow-hidden p-0 ${activePage === "article" ? "" : "hidden"}`}>
          <div className="border-b border-[#efefef] px-5 py-4">
            <h3 className="text-base font-semibold">タイムライン</h3>
            <p className="mt-1 text-xs text-[#8e8e8e]">写真とキャプションをシェア（インスタ風）</p>
          </div>

          <form className="space-y-3 border-b border-[#efefef] px-5 py-4" onSubmit={(e) => void createFeedPost(e)}>
            <p className="text-xs font-semibold text-[#262626]">新規投稿</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={postFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="max-w-full text-sm text-[#57534e] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0095f6] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
                onChange={onPostFileChange}
              />
            </div>
            {postUploadPreview ? (
              <div className="overflow-hidden rounded-lg border border-[#dbdbdb] bg-[#fafafa]">
                {/* eslint-disable-next-line @next/next/no-img-element -- ユーザー選択ファイルのプレビュー */}
                <img src={postUploadPreview} alt="" className="max-h-72 w-full object-contain" />
              </div>
            ) : null}
            <textarea
              className={`min-h-[4.5rem] w-full ${inputClass}`}
              placeholder="キャプションを書く…（任意）"
              value={postCaption}
              onChange={(e) => setPostCaption(e.target.value)}
              maxLength={2200}
            />
            <button className={primaryButtonClass} type="submit" disabled={postPosting || !postFile || requiresLogin}>
              {postPosting ? "投稿中…" : "シェア"}
            </button>
            {requiresLogin ? (
              <p className="text-xs text-[#ed4956]">ログインすると投稿・いいねができます。</p>
            ) : null}
          </form>

          <ul className="divide-y divide-[#efefef]">
            {feedPosts.map((post) => (
              <li key={post.id} className="px-0 py-0">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] p-[2px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[1px]">
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#262626] text-xs font-bold text-white">
                          {(post.authorName.trim().charAt(0) || "?").toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#262626]">{post.authorName}</p>
                      <p className="text-[11px] text-[#8e8e8e]">{formatFeedTime(post.createdAt)}</p>
                    </div>
                  </div>
                  {session && session.user.id === post.authorId && post.authorId !== "demo" ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[#ed4956] hover:underline"
                      onClick={() => void deleteFeedPost(post)}
                    >
                      削除
                    </button>
                  ) : null}
                </div>
                <div className="aspect-square w-full bg-[#fafafa]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 外部URL・data URL・blob */}
                  <img src={post.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-2xl leading-none transition active:scale-95"
                      onClick={() => void toggleFeedPostLike(post)}
                      aria-label={post.likedByMe ? "いいねを取り消す" : "いいねする"}
                    >
                      <span className={post.likedByMe ? "text-[#ed4956]" : "text-[#262626]"}>
                        {post.likedByMe ? "♥" : "♡"}
                      </span>
                    </button>
                    {post.likeCount > 0 ? (
                      <span className="text-sm font-semibold text-[#262626]">
                        {post.likeCount.toLocaleString("ja-JP")} 件のいいね
                      </span>
                    ) : (
                      <span className="text-sm text-[#8e8e8e]">いいねしてね</span>
                    )}
                  </div>
                  {post.caption ? (
                    <p className="text-sm leading-relaxed text-[#262626]">
                      <span className="font-semibold">{post.authorName}</span>{" "}
                      <span className="whitespace-pre-wrap break-words">{post.caption}</span>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {feedPosts.length === 0 && canUseSupabase ? (
            <p className="px-5 py-6 text-center text-sm text-[#8e8e8e]">まだ投稿がありません。最初のシェアを投稿してみよう。</p>
          ) : null}
        </section>

        <section className={`${cardClass} ${activePage === "article" ? "" : "hidden"}`}>
          <h3 className="text-base font-semibold">フィード（記事）</h3>
          <p className="mt-1 text-xs text-[#8e8e8e]">インタビュー・ストーリーを流すエリア</p>
          {role === "investor" ? (
            <form className="mt-3 grid gap-2" onSubmit={addArticle}>
              <input
                className={inputClass}
                placeholder="記事タイトル"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                required
              />
              <textarea
                className={inputClass}
                placeholder="概要"
                value={articleSummary}
                onChange={(e) => setArticleSummary(e.target.value)}
                required
              />
              <button className={primaryButtonClass} type="submit" disabled={busy || requiresLogin}>
                掲載枠に追加
              </button>
            </form>
          ) : null}
          <ul className="mt-3 space-y-2">
            {articles.map((a) => (
              <li key={a.id} className="border-b border-[#efefef] py-3 text-sm last:border-0">
                <p className="font-semibold text-[#262626]">
                  {a.title}{" "}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      a.status === "published" ? "bg-[#e7f6ef] text-[#18794e]" : "bg-[#efefef] text-[#8e8e8e]"
                    }`}
                  >
                    {a.status}
                  </span>
                </p>
                <p className="mt-1 text-[#262626]">{a.summary}</p>
                {role === "investor" ? (
                  <button
                    className="mt-2 rounded-md border border-[#dbdbdb] bg-white px-3 py-1 text-xs font-semibold text-[#0095f6]"
                    type="button"
                    onClick={() => void publishArticle(a.id, a.status)}
                    disabled={requiresLogin}
                  >
                    {a.status === "published" ? "下書きに戻す" : "公開する"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`${cardClass} flex flex-col ${activePage === "mentor" ? "" : "hidden"} min-h-[min(72vh,560px)]`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">メンター（DM）</h3>
            <button
              type="button"
              className="text-xs font-semibold text-[#0095f6] hover:text-[#1877f2]"
              onClick={clearMentorChat}
            >
              クリア
            </button>
          </div>
          <p className="mt-1 text-xs text-[#8e8e8e]">続きはそのままのペースで送ってください。</p>

          <div className="mt-3 flex min-h-[min(48vh,380px)] flex-1 flex-col rounded-md border border-[#dbdbdb] bg-[#fafafa]">
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {mentorMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(100%,28rem)] rounded-[22px] px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-md bg-[#efefef] text-[#262626]"
                        : "rounded-bl-md border border-[#dbdbdb] bg-white text-[#262626]"
                    }`}
                  >
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      {m.role === "user" ? "あなた" : "AIメンター"}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ))}
              {mentorLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-[22px] rounded-bl-md border border-[#dbdbdb] bg-white px-3.5 py-2.5 text-sm text-[#8e8e8e]">
                    考え中…
                  </div>
                </div>
              ) : null}
              <div ref={mentorScrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
            </div>

            {mentorError ? (
              <p className="mx-3 mb-2 rounded-md border border-[#ffc9c9] bg-[#fff5f5] px-3 py-2 text-xs text-[#ed4956]">{mentorError}</p>
            ) : null}

            <form className="flex gap-2 border-t border-[#dbdbdb] bg-white p-3" onSubmit={(e) => void sendMentorMessage(e)}>
              <textarea
                className="min-h-[44px] max-h-36 flex-1 resize-y rounded-lg border border-[#dbdbdb] bg-[#fafafa] px-3 py-2.5 text-base text-[#262626] outline-none transition focus:border-[#a8a8a8] focus:bg-white"
                placeholder="メッセージを入力…（Enter で送信 / Shift+Enter で改行）"
                value={mentorInput}
                onChange={(e) => setMentorInput(e.target.value)}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMentorMessage();
                  }
                }}
              />
              <button
                className={`shrink-0 self-end ${primaryButtonClass}`}
                type="submit"
                disabled={mentorLoading || !mentorInput.trim()}
              >
                {mentorLoading ? "…" : "送信"}
              </button>
            </form>
          </div>
        </section>

        <section className={`${cardClass} ${activePage === "matching" ? "" : "hidden"}`}>
          <h3 className="text-base font-semibold">発見（仲間を探す）</h3>
          <form onSubmit={runMatching} className="mt-3 flex gap-2">
            <input
              className={`flex-1 ${inputClass}`}
              placeholder="目標を入力"
              value={matchGoal}
              onChange={(e) => setMatchGoal(e.target.value)}
              required
            />
            <button className={primaryButtonClass} type="submit">
              検索
            </button>
          </form>
          {matchNotice ? <p className="mt-2 text-sm text-[#8e8e8e]">{matchNotice}</p> : null}
          <ul className="mt-3 space-y-2 text-sm">
            {matches.map((m) => (
              <li key={m.id ?? `${m.name}-${m.goal}`} className="rounded-md border border-[#dbdbdb] bg-white p-3">
                <p className="font-medium">{m.name}</p>
                <p>{m.goal}</p>
                <p className="text-[#8e8e8e]">得意: {m.strength}</p>
                <div className="mt-2">
                  {session && m.id && m.id !== session.user.id ? (
                    <button
                      type="button"
                      className="rounded-lg bg-[#0095f6] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1877f2]"
                      onClick={() => void openDmFromMatch(m.id as string, m.name)}
                    >
                      メッセージを送る
                    </button>
                  ) : !m.id ? (
                    <p className="text-xs text-[#8e8e8e]">デモ一覧のため、接続はログイン＋検索結果からどうぞ</p>
                  ) : (
                    <p className="text-xs text-[#8e8e8e]">自分自身にはつながれません</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${cardClass} ${activePage === "programming" ? "" : "hidden"}`}>
          <h3 className="text-base font-semibold">コード</h3>
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-[#dbdbdb] bg-[#fafafa] p-3 font-mono text-base text-[#262626] outline-none transition focus:border-[#a8a8a8] focus:bg-white"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className={`mt-2 ${primaryButtonClass}`} type="button" onClick={runCode}>
            実行
          </button>
          <pre className="mt-3 rounded-md border border-[#262626] bg-[#262626] p-3 text-sm text-[#fafafa]">{codeOutput}</pre>
        </section>

        <section className={`${cardClass} ${activePage === "pitch" ? "" : "hidden"}`}>
          <h3 className="text-base font-semibold">ピッチ</h3>
          <form className="mt-3 grid gap-2" onSubmit={addPitch}>
            <input
              className={inputClass}
              placeholder="ピッチタイトル"
              value={pitchTitle}
              onChange={(e) => setPitchTitle(e.target.value)}
              required
            />
            <textarea
              className={inputClass}
              placeholder="内容"
              value={pitchBody}
              onChange={(e) => setPitchBody(e.target.value)}
              required
            />
            <button className={primaryButtonClass} type="submit" disabled={busy || requiresLogin}>
              投稿
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {pitches.map((p) => (
              <li key={p.id} className="rounded-md border border-[#dbdbdb] bg-white p-3">
                <p className="font-semibold text-[#262626]">{p.title}</p>
                <p className="text-sm text-[#262626]">{p.body}</p>
                <button
                  className="mt-2 rounded-md border border-[#dbdbdb] bg-white px-3 py-1 text-sm font-semibold text-[#262626]"
                  type="button"
                  onClick={() => void cheerPitch(p.id, p.likes)}
                  disabled={busy || requiresLogin}
                >
                  応援 {p.likes}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`overflow-hidden rounded-none border border-[#dbdbdb] bg-white sm:rounded-lg ${activePage === "chat" ? "" : "hidden"} flex min-h-[min(72vh,580px)] flex-col p-0`}
        >
          {chatSubView === "list" ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dbdbdb] bg-white px-4 py-3">
                <h3 className="text-[17px] font-semibold tracking-tight text-[#262626]">メッセージ</h3>
                <span className="text-xs font-semibold text-[#0095f6]">moni</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[#efefef] bg-white px-4 py-3 text-left transition hover:bg-[#fafafa] active:bg-[#efefef]"
                  onClick={() => {
                    setActiveRoomId("global");
                    setChatSubView("room");
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] p-[2px]"
                    aria-hidden
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-bold text-[#262626]">
                      #
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold text-[#262626]">みんなのルーム</p>
                      {globalTalkPreview.timeLabel ? (
                        <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">
                          {globalTalkPreview.timeLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] leading-snug text-[#8e8e8e]">{globalTalkPreview.previewText}</p>
                      {globalTalkPreview.unread > 0 ? (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
                          {globalTalkPreview.unread > 99 ? "99" : globalTalkPreview.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
                {dmPeers.map((row) => {
                  const meta = talkMeta[row.room_id] ?? {
                    previewText: "メッセージはまだありません",
                    timeLabel: "",
                    unread: 0,
                  };
                  const initial = (row.peer_name?.trim()?.charAt(0) || "?").toUpperCase();
                  return (
                    <button
                      key={row.room_id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-[#efefef] bg-white px-4 py-3 text-left transition hover:bg-[#fafafa] active:bg-[#efefef]"
                      onClick={() => {
                        setActiveRoomId(row.room_id);
                        setChatSubView("room");
                      }}
                    >
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#262626] text-lg font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[15px] font-semibold text-[#262626]">{row.peer_name}</p>
                          {meta.timeLabel ? (
                            <span className="shrink-0 text-[11px] tabular-nums text-[#8e8e8e]">{meta.timeLabel}</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] leading-snug text-[#8e8e8e]">{meta.previewText}</p>
                          {meta.unread > 0 ? (
                            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-[11px] font-bold text-white">
                              {meta.unread > 99 ? "99" : meta.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <p className="px-4 py-6 text-center text-[12px] leading-relaxed text-[#8e8e8e]">
                  「発見」で検索して<strong className="text-[#262626]">メッセージを送る</strong>
                  と、1対1のルームが増えます。
                </p>
              </div>
            </>
          ) : (
            <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#dbdbdb] bg-white px-1 py-2 pr-2">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl font-light text-[#262626] transition hover:bg-[#fafafa]"
              aria-label="一覧に戻る"
              onClick={() => setChatSubView("list")}
            >
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold tracking-tight text-[#262626]">
                {activeRoomId === "global"
                  ? "みんなのルーム"
                  : dmPeers.find((p) => p.room_id === activeRoomId)?.peer_name ?? "メッセージ"}
              </p>
              <p className="truncate text-[11px] text-[#8e8e8e]">
                {activeRoomId === "global"
                  ? onlineUsers.length > 0
                    ? `アクティブ ${onlineUsers.join(" · ")}`
                    : ""
                  : "マッチからつながったトーク"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-[#262626] transition hover:bg-[#fafafa]"
                title="通話（Jitsi）"
                aria-label="通話を開始"
                onClick={startJitsiCall}
              >
                📞
              </button>
              {callUrl ? (
                <a
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-[#262626] transition hover:bg-[#fafafa]"
                  href={callUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="通話を再度開く"
                  aria-label="通話を再度開く"
                >
                  📹
                </a>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-b border-[#efefef] bg-[#fafafa] px-3 py-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#8e8e8e]">表示名</label>
            <input
              className="mt-1 w-full rounded-md border border-[#dbdbdb] bg-white px-3 py-1.5 text-base text-[#262626] outline-none focus:border-[#a8a8a8]"
              placeholder="表示名"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white px-2 py-3">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#8e8e8e]">まだメッセージがありません。</p>
            ) : null}
            {messages.map((m, i) => {
              const isMine = Boolean(session?.user?.id && m.senderId === session.user.id);
              const initial = (m.sender?.trim()?.charAt(0) || "?").toUpperCase();
              const showUnreadLine = firstUnreadMessageIndex === i;
              return (
                <div key={m.id} className="space-y-3">
                  {showUnreadLine ? (
                    <div
                      className="flex items-center gap-2 px-1 py-1"
                      role="status"
                      aria-label="ここから未読のメッセージ"
                    >
                      <div className="h-px min-w-[1rem] flex-1 bg-[#dbdbdb]" />
                      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-[#8e8e8e]">
                        新しいメッセージ
                      </span>
                      <div className="h-px min-w-[1rem] flex-1 bg-[#dbdbdb]" />
                    </div>
                  ) : null}
                  <div className={`flex w-full gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMine ? (
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c7c7c7] text-xs font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                    ) : (
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#262626] text-xs font-bold text-white"
                        aria-hidden
                      >
                        {initial}
                      </div>
                    )}
                    <div
                      className={`max-w-[min(100%,20rem)] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}
                    >
                      {!isMine ? (
                        <span className="pl-1 text-[11px] font-semibold text-[#8e8e8e]">{m.sender}</span>
                      ) : null}
                      <div
                        className={`rounded-[22px] px-3 py-2 text-sm leading-relaxed ${
                          isMine
                            ? "rounded-tr-sm bg-[#efefef] text-[#262626]"
                            : "rounded-tl-sm border border-[#dbdbdb] bg-white text-[#262626]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                      <div
                        className={`flex items-center gap-1 ${isMine ? "flex-row-reverse justify-end pr-0.5" : "pl-1"}`}
                      >
                        <span className="text-[11px] tabular-nums text-[#8e8e8e]">{m.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatScrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

          <form
            className="flex shrink-0 items-end gap-2 border-t border-[#dbdbdb] bg-[#fafafa] p-2"
            onSubmit={(e) => void addMessage(e)}
          >
            <textarea
              className="max-h-32 min-h-[44px] flex-1 resize-y rounded-3xl border border-[#dbdbdb] bg-white px-3 py-2.5 text-base text-[#262626] outline-none focus:border-[#a8a8a8]"
              placeholder="メッセージ…"
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              required
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!chatName.trim() || !chatBody.trim() || busy || requiresLogin) return;
                  void addMessage();
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || requiresLogin || !chatName.trim() || !chatBody.trim()}
              className="mb-0.5 flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-[#0095f6] text-sm font-semibold text-white transition hover:bg-[#1877f2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              送信
            </button>
          </form>
          {callRoom ? (
            <p className="shrink-0 border-t border-[#efefef] bg-white px-3 py-2 text-center text-[11px] text-[#8e8e8e]">
              通話ルーム:{" "}
              <code className="rounded bg-[#efefef] px-1 py-0.5 font-mono text-[10px] text-[#262626]">{callRoom}</code>
              {callUrl ? (
                <>
                  {" · "}
                  <a className="font-semibold text-[#0095f6] underline underline-offset-2" href={callUrl} target="_blank" rel="noreferrer">
                    開く
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
            </>
          )}
        </section>
      </main>
        </div>
      </div>

      <nav
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-[#e8e8ec] bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-12px_40px_rgba(99,102,241,0.08)] backdrop-blur-md"
        aria-label="メイン機能の切り替え"
      >
        <div className="mx-auto flex w-full max-w-full flex-nowrap justify-between gap-0 overflow-x-auto px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-1 [&::-webkit-scrollbar]:hidden">
          {featureItems.map((item) => (
            <button
              key={item.key}
              className={`relative min-w-[3.1rem] shrink-0 sm:min-w-0 sm:flex-1 ${bottomNavButtonClass(item.key)}`}
              type="button"
              onClick={() => {
                if (item.key === "chat") setChatSubView("list");
                setActivePage(item.key);
              }}
              aria-label={
                item.key === "chat" && totalTalkUnread > 0 ? `${item.label}、未読${totalTalkUnread}件` : item.label
              }
              title={item.label}
            >
              <span className="text-[1.35rem] leading-none">{item.icon}</span>
              <span className="max-w-[4.75rem] truncate leading-tight">{item.label}</span>
              {item.key === "chat" && totalTalkUnread > 0 && activePage !== "chat" ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                  {totalTalkUnread > 99 ? "99+" : totalTalkUnread}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
