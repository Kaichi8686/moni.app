"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  History,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AiChatHistoryRail } from "@/components/ai/AiChatHistoryRail";
import { AiChatStreamingRichText } from "@/components/ai/AiChatStreamingRichText";
import {
  newAiId,
  upsertActiveConversation,
  type AiChatMessage,
  type AiSavedConversation,
} from "@/lib/ai/chatConversations";
import { createMyIdea } from "@/lib/idea-hub/myIdeas";
import {
  blankIdeaInterviewConversation,
  conversationToSession,
  loadIdeaInterviewConversations,
  saveIdeaInterviewConversations,
  sessionToThreadMeta,
  upsertIdeaInterviewConversation,
  type IdeaInterviewConversation,
} from "@/lib/idea-interview/conversations";
import {
  blankConsultConversation,
  loadConsultConversations,
  saveConsultConversations,
  type IdeaPersonalAiMode,
} from "@/lib/idea-interview/personalAi";
import { firstAssistantForTheme } from "@/lib/idea-interview/ruleEngine";
import { emptySession } from "@/lib/idea-interview/session";
import {
  IDEA_INTERVIEW_HANDOFF_KEY,
  IDEA_INTERVIEW_THEMES,
  type IdeaInterviewHandoff,
  type IdeaInterviewSession,
  type IdeaInterviewTheme,
  type IdeaSeed,
  themeLabel,
} from "@/lib/idea-interview/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

const THEME_STARTERS: Record<IdeaInterviewTheme, { prompt: string; hint: string }> = {
  school: { prompt: "学校のモヤモヤから探す", hint: "授業・提出・人間関係" },
  parttime: { prompt: "バイトの困りごとから探す", hint: "シフト・接客・シフト表" },
  club: { prompt: "部活・サークルから探す", hint: "練習・運営・メンバー" },
  friends: { prompt: "友人関係から探す", hint: "つながりのしづらさ" },
  family: { prompt: "家庭のことから探す", hint: "家事・お金・会話" },
  other: { prompt: "その他の日常から探す", hint: "なんでもOK" },
};

const THEME_STARTERS_EN: Record<IdeaInterviewTheme, { prompt: string; hint: string }> = {
  school: { prompt: "Start from school frustrations", hint: "Classes, assignments, relationships" },
  parttime: { prompt: "Start from part-time job hassles", hint: "Shifts, customers, schedules" },
  club: { prompt: "Start from club or circle life", hint: "Practice, ops, members" },
  friends: { prompt: "Start from friendships", hint: "Hard-to-connect moments" },
  family: { prompt: "Start from home life", hint: "Chores, money, conversations" },
  other: { prompt: "Start from everyday life", hint: "Anything is fine" },
};

type Props = {
  /** standalone = full page; hub = ideas tab; project = workspace */
  variant?: "standalone" | "hub" | "project";
  projectId?: string;
  /** Hub default mode (相談 tab → consult, 発掘 tab → excavate) */
  initialMode?: IdeaPersonalAiMode;
};

export function IdeaInterviewApp({
  variant = "standalone",
  projectId,
  initialMode = "excavate",
}: Props) {
  const { tx, locale } = useI18n();
  const isProject = variant === "project" && Boolean(projectId);
  const isHub = variant === "hub";
  const exitHref = isProject ? `/projects/${projectId}/overview` : isHub ? "/idea" : "/";
  const deepDiveHref = isProject ? `/projects/${projectId}/coach?mode=ideas` : "/?tab=mentor&mentor=ai";
  const newTitle = tx("新しいチャット", "New chat");

  const [ownerKey, setOwnerKey] = useState("guest");
  const [ownerReady, setOwnerReady] = useState(false);
  const [aiMode, setAiMode] = useState<IdeaPersonalAiMode>(isProject ? "excavate" : initialMode);

  const [excavateConversations, setExcavateConversations] = useState<IdeaInterviewConversation[]>([]);
  const [consultConversations, setConsultConversations] = useState<AiSavedConversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [session, setSession] = useState<IdeaInterviewSession>(emptySession);
  const [consultMessages, setConsultMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [placeholder, setPlaceholder] = useState(
    tx("思いつく範囲でOKです", "Whatever comes to mind is fine"),
  );
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [savingSeedId, setSavingSeedId] = useState<string | null>(null);
  const [savedSeedIds, setSavedSeedIds] = useState<Record<string, true>>({});
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startFreshOnModeChangeRef = useRef(false);
  /** Persist only under the owner(+project) scope that was last hydrated. */
  const persistScopeRef = useRef("");

  const isConsult = aiMode === "consult";
  const messages = isConsult ? consultMessages : (session.messages as AiChatMessage[]);
  const conversations = isConsult ? consultConversations : excavateConversations;
  const excavateHome = !isConsult && (session.phase === "intro" || session.phase === "theme");
  const showModeHome = isConsult
    ? consultMessages.filter((m) => m.role === "user").length === 0 &&
      consultMessages.every((m) => m.role === "assistant")
    : excavateHome;
  const activeTitle = conversations.find((c) => c.id === activeId)?.title || newTitle;
  const projectScopeId = isProject ? projectId : undefined;

  useEffect(() => {
    if (!isProject) setAiMode(initialMode);
  }, [initialMode, isProject]);

  useEffect(() => {
    setOwnerReady(true);
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2000)),
        ]);
        const uid = result && "data" in result ? result.data.session?.user.id : undefined;
        if (!cancelled && uid) setOwnerKey(uid);
      } catch {
        /* keep guest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hydrateMode = useCallback(
    (mode: IdeaPersonalAiMode, preferFresh: boolean) => {
      setHydrated(false);
      persistScopeRef.current = "";
      setDraft("");
      setError("");
      setStreamingId(null);
      setHistoryOpen(false);
      setSavedSeedIds({});
      setGenerating(false);
      setSending(false);

      if (mode === "consult") {
        const loaded = loadConsultConversations(ownerKey, newTitle);
        if (preferFresh) {
          const blank = blankConsultConversation(newTitle);
          const next = [blank, ...loaded.conversations].slice(0, 30);
          setConsultConversations(next);
          setActiveId(blank.id);
          setConsultMessages(blank.messages);
        } else {
          setConsultConversations(loaded.conversations);
          setActiveId(loaded.activeId);
          const active =
            loaded.conversations.find((c) => c.id === loaded.activeId) ?? loaded.conversations[0]!;
          setConsultMessages(active.messages);
        }
        setSession(emptySession());
        persistScopeRef.current = `consult:${ownerKey}`;
      } else {
        const loaded = loadIdeaInterviewConversations(ownerKey, newTitle, projectScopeId);
        if (preferFresh) {
          const blank = blankIdeaInterviewConversation(newTitle);
          const next = [blank, ...loaded.conversations].slice(0, 30);
          setExcavateConversations(next);
          setActiveId(blank.id);
          setSession(conversationToSession(blank));
        } else {
          setExcavateConversations(loaded.conversations);
          setActiveId(loaded.activeId);
          const active =
            loaded.conversations.find((c) => c.id === loaded.activeId) ?? loaded.conversations[0]!;
          setSession(conversationToSession(active));
        }
        setConsultMessages([]);
        persistScopeRef.current = projectScopeId
          ? `excavate:project:${projectScopeId}:${ownerKey}`
          : `excavate:${ownerKey}`;
      }
      setHydrated(true);
    },
    [newTitle, ownerKey, projectScopeId],
  );

  useEffect(() => {
    if (!ownerReady) return;
    const preferFresh = startFreshOnModeChangeRef.current;
    startFreshOnModeChangeRef.current = false;
    hydrateMode(aiMode, preferFresh);
  }, [ownerReady, ownerKey, aiMode, projectScopeId, hydrateMode]);

  useEffect(() => {
    if (!hydrated || !activeId || isConsult || !persistScopeRef.current) return;
    setExcavateConversations((prev) =>
      upsertIdeaInterviewConversation(
        prev,
        activeId,
        messages,
        sessionToThreadMeta(session),
        newTitle,
      ),
    );
  }, [messages, session, activeId, hydrated, newTitle, isConsult]);

  useEffect(() => {
    if (!hydrated || !activeId || !isConsult || !persistScopeRef.current) return;
    setConsultConversations((prev) => upsertActiveConversation(prev, activeId, consultMessages, newTitle));
  }, [consultMessages, activeId, hydrated, newTitle, isConsult]);

  useEffect(() => {
    if (!hydrated || !activeId || !ownerReady || !persistScopeRef.current) return;
    if (isConsult) {
      if (persistScopeRef.current !== `consult:${ownerKey}`) return;
      saveConsultConversations(ownerKey, activeId, consultConversations);
    } else {
      const expected = projectScopeId
        ? `excavate:project:${projectScopeId}:${ownerKey}`
        : `excavate:${ownerKey}`;
      if (persistScopeRef.current !== expected) return;
      saveIdeaInterviewConversations(ownerKey, activeId, excavateConversations, projectScopeId);
    }
  }, [
    activeId,
    consultConversations,
    excavateConversations,
    hydrated,
    isConsult,
    ownerKey,
    ownerReady,
    projectScopeId,
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, generating, session.phase, session.seeds, aiMode]);

  const startNewChat = useCallback(() => {
    if (isConsult) {
      const hasUser = consultMessages.some((m) => m.role === "user");
      if (!hasUser) {
        setDraft("");
        setError("");
        setHistoryOpen(false);
        return;
      }
      const blank = blankConsultConversation(newTitle);
      setConsultConversations((prev) => [blank, ...prev].slice(0, 30));
      setActiveId(blank.id);
      setConsultMessages(blank.messages);
      setStreamingId(blank.messages[0]?.id ?? null);
      setDraft("");
      setError("");
      setHistoryOpen(false);
      return;
    }

    if (excavateHome && messages.length === 0) {
      setDraft("");
      setError("");
      setHistoryOpen(false);
      return;
    }
    const blank = blankIdeaInterviewConversation(newTitle);
    setExcavateConversations((prev) => [blank, ...prev].slice(0, 30));
    setActiveId(blank.id);
    setSession(conversationToSession(blank));
    setDraft("");
    setError("");
    setStreamingId(null);
    setSavedSeedIds({});
    setHistoryOpen(false);
  }, [consultMessages, excavateHome, isConsult, messages.length, newTitle]);

  const openConversation = useCallback(
    (conversation: { id: string }) => {
      if (isConsult) {
        const full = consultConversations.find((c) => c.id === conversation.id);
        if (!full) return;
        setActiveId(full.id);
        setConsultMessages(full.messages);
        setStreamingId(null);
        setError("");
        setDraft("");
        setHistoryOpen(false);
        return;
      }
      const full = excavateConversations.find((c) => c.id === conversation.id);
      if (!full) return;
      setActiveId(full.id);
      setSession(conversationToSession(full));
      setDraft("");
      setError("");
      setStreamingId(null);
      setSavedSeedIds({});
      setHistoryOpen(false);
    },
    [consultConversations, excavateConversations, isConsult],
  );

  const deleteConversation = useCallback(
    (conversationId: string) => {
      if (isConsult) {
        const remaining = consultConversations.filter((c) => c.id !== conversationId);
        if (conversationId !== activeId) {
          setConsultConversations(remaining);
          return;
        }
        if (remaining[0]) {
          setConsultConversations(remaining);
          setActiveId(remaining[0].id);
          setConsultMessages(remaining[0].messages);
          setStreamingId(null);
          return;
        }
        const blank = blankConsultConversation(newTitle);
        setConsultConversations([blank]);
        setActiveId(blank.id);
        setConsultMessages(blank.messages);
        return;
      }

      const remaining = excavateConversations.filter((c) => c.id !== conversationId);
      if (conversationId !== activeId) {
        setExcavateConversations(remaining);
        return;
      }
      if (remaining[0]) {
        setExcavateConversations(remaining);
        setActiveId(remaining[0].id);
        setSession(conversationToSession(remaining[0]));
        return;
      }
      const blank = blankIdeaInterviewConversation(newTitle);
      setExcavateConversations([blank]);
      setActiveId(blank.id);
      setSession(conversationToSession(blank));
    },
    [activeId, consultConversations, excavateConversations, isConsult, newTitle],
  );

  const generateIdeas = useCallback(
    async (next: IdeaInterviewSession) => {
      if (!next.theme) return;
      setGenerating(true);
      setError("");
      try {
        const res = await fetch("/api/idea-interview/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ theme: next.theme, messages: next.messages }),
        });
        const data = (await res.json()) as { seeds?: IdeaSeed[]; error?: string };
        if (!res.ok || !data.seeds?.length) {
          throw new Error(data.error || "ideas_failed");
        }
        setSession({
          ...next,
          seeds: data.seeds,
          phase: "results",
          readyForIdeas: true,
        });
      } catch {
        setError(
          tx("アイデアの生成に失敗しました。もう一度お試しください。", "Couldn’t generate ideas. Please try again."),
        );
        setSession({ ...next, phase: "results", seeds: next.seeds });
      } finally {
        setGenerating(false);
      }
    },
    [tx],
  );

  const chooseTheme = (theme: IdeaInterviewTheme) => {
    const first = firstAssistantForTheme(theme);
    const msg: AiChatMessage = {
      id: newAiId("a"),
      role: "assistant",
      content: first.content,
    };
    setPlaceholder(first.placeholder);
    setError("");
    setStreamingId(msg.id);
    setSession({
      ...emptySession(),
      phase: "chat",
      theme,
      messages: [msg],
      userTurns: 0,
      updatedAt: new Date().toISOString(),
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const sendConsult = async (text: string) => {
    setSending(true);
    setError("");
    const userMsg: AiChatMessage = { id: newAiId("u"), role: "user", content: text };
    const next = [...consultMessages, userMsg];
    setConsultMessages(next);
    setDraft("");
    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply?.trim()) {
        throw new Error(json.error || "chat_failed");
      }
      const assistantId = newAiId("a");
      setConsultMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: json.reply!.trim() },
      ]);
      setStreamingId(assistantId);
    } catch {
      setError(
        tx(
          "応答に失敗しました。通信状況を確かめてもう一度送ってください。",
          "Reply failed. Check your connection and try again.",
        ),
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const sendChat = async (text: string, base: IdeaInterviewSession) => {
    if (!base.theme) return;
    setSending(true);
    setError("");
    const userMsg: AiChatMessage = { id: newAiId("u"), role: "user", content: text };
    const userTurns = base.userTurns + 1;
    const withUser: IdeaInterviewSession = {
      ...base,
      phase: "chat",
      messages: [...base.messages, userMsg],
      userTurns,
    };
    setSession(withUser);
    setDraft("");

    try {
      const res = await fetch("/api/idea-interview/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme: base.theme,
          userTurns,
          latestUserMessage: text,
          history: withUser.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as {
        assistantMessage?: string;
        placeholder?: string;
        readyForIdeas?: boolean;
        error?: string;
      };
      if (!res.ok || !data.assistantMessage) {
        throw new Error(data.error || "chat_failed");
      }
      if (data.placeholder) setPlaceholder(data.placeholder);
      const assistantId = newAiId("a");
      const next: IdeaInterviewSession = {
        ...withUser,
        messages: [
          ...withUser.messages,
          { id: assistantId, role: "assistant", content: data.assistantMessage },
        ],
        readyForIdeas: Boolean(data.readyForIdeas),
      };
      setSession(next);
      setStreamingId(assistantId);
      if (data.readyForIdeas) {
        await generateIdeas(next);
      }
    } catch {
      setError(
        tx(
          "応答に失敗しました。通信状況を確かめてもう一度送ってください。",
          "Reply failed. Check your connection and try again.",
        ),
      );
      setSession(withUser);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const sendAnswer = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (isConsult) {
      await sendConsult(text);
      return;
    }
    if (!session.theme) return;
    await sendChat(text, session);
  };

  const startFromComposer = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (isConsult) {
      await sendConsult(text);
      return;
    }
    const theme: IdeaInterviewTheme = "other";
    const first = firstAssistantForTheme(theme);
    const assistantMsg: AiChatMessage = {
      id: newAiId("a"),
      role: "assistant",
      content: first.content,
    };
    const base: IdeaInterviewSession = {
      ...emptySession(),
      phase: "chat",
      theme,
      messages: [assistantMsg],
      userTurns: 0,
      updatedAt: new Date().toISOString(),
    };
    setPlaceholder(first.placeholder);
    setSession(base);
    setStreamingId(assistantMsg.id);
    await sendChat(text, base);
  };

  const handoffToCoach = (seed: IdeaSeed) => {
    const handoff: IdeaInterviewHandoff = {
      seedTitle: seed.title,
      seedSummary: seed.summary,
      theme: session.theme,
      notes: session.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n"),
    };
    try {
      sessionStorage.setItem(IDEA_INTERVIEW_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      /* ignore */
    }
    window.location.href = deepDiveHref;
  };

  const saveSeedToMyIdeas = async (seed: IdeaSeed) => {
    if (savedSeedIds[seed.id] || savingSeedId) return;
    setSavingSeedId(seed.id);
    setError("");
    const { error: err } = await createMyIdea({
      title: seed.title,
      memo: seed.summary,
      source: "interview",
      seed_id: seed.id,
      theme: session.theme,
    });
    setSavingSeedId(null);
    if (err === "login_required") {
      window.location.href = "/login";
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    setSavedSeedIds((prev) => ({ ...prev, [seed.id]: true }));
  };

  const matchingHref = useMemo(() => {
    const theme = session.theme ?? "other";
    return `/discover?from=idea-interview&theme=${encodeURIComponent(theme)}`;
  }, [session.theme]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (showModeHome || excavateHome) await startFromComposer();
    else await sendAnswer();
  }

  const historyRail = (
    <AiChatHistoryRail
      conversations={conversations}
      activeId={activeId}
      onSelect={openConversation}
      onNew={startNewChat}
      onDelete={deleteConversation}
      locale={locale === "en" ? "en-US" : "ja-JP"}
      title={tx("チャット履歴", "Chat history")}
      newLabel={newTitle}
      emptyLabel={tx("まだ会話がありません", "No chats yet")}
      className="h-full"
    />
  );

  if (!ownerReady || !hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-white text-sm text-[#6B7280]">
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }

  const shellClass = isHub
    ? "flex h-[calc(100dvh-var(--bottom-nav-clearance)-7.5rem)] min-h-[420px] w-full overflow-hidden bg-white"
    : isProject
      ? "flex min-h-[520px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm"
      : "flex h-[calc(100dvh-var(--bottom-nav-clearance))] min-h-0 w-full overflow-hidden bg-white";

  const modeLabel = isConsult ? tx("相談", "Chat") : tx("発掘", "Discover");

  return (
    <div className={shellClass}>
      <div className={`hidden shrink-0 border-r border-[#E5E7EB] md:block ${isProject ? "w-[240px]" : "w-[260px]"}`}>
        {historyRail}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 shrink-0 border-b border-[#F3F4F6] bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2">
            {!isHub ? (
              <Link
                href={exitHref}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#374151] transition hover:bg-[#F3F4F6]"
                aria-label={
                  isProject
                    ? tx("プロジェクトに戻る", "Back to project")
                    : tx("ホームに戻る", "Back to home")
                }
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-[#1A1A1A]">AI</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[#6B7280]">
                {session.phase === "results" && !isConsult
                  ? `${tx("アイデアの種", "Idea seeds")} · ${activeTitle}`
                  : !isConsult && session.theme
                    ? `${modeLabel} · ${tx(
                        themeLabel(session.theme),
                        (
                          {
                            school: "School",
                            parttime: "Part-time job",
                            club: "Club",
                            friends: "Friends",
                            family: "Home",
                            other: "Other",
                          } as const
                        )[session.theme],
                      )} · ${activeTitle}`
                    : `${modeLabel} · ${activeTitle}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 text-[12px] font-semibold text-[#374151] md:hidden"
              >
                <History className="h-3.5 w-3.5" aria-hidden />
                {tx("履歴", "History")}
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                {tx("新規", "New")}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {showModeHome ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 px-2 py-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <Sparkles className="h-6 w-6" aria-hidden />
              </div>
              <p className="max-w-md text-center text-[13px] leading-relaxed text-[#6B7280]">
                {isConsult
                  ? tx(
                      "困っていることや質問を、そのまま送ってください。会話は個人用として自動保存され、履歴からいつでも続けられます。",
                      "Send whatever you’re stuck on. Chats are saved privately — continue anytime from History.",
                    )
                  : tx(
                      "日常のモヤモヤを聞くところから、ビジネスの種を一緒に探します。会話は個人用として自動保存されます。",
                      "We’ll start from everyday frustrations and look for business seeds. Chats are saved privately for you.",
                    )}
              </p>

              {!isConsult ? (
                <div className="grid w-full max-w-md grid-cols-2 gap-3">
                  {IDEA_INTERVIEW_THEMES.map((t) => {
                    const starter = THEME_STARTERS[t.id];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => chooseTheme(t.id)}
                        className="flex min-h-[96px] flex-col items-start justify-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50/40"
                      >
                        <span className="text-[14px] font-bold leading-snug text-[#1A1A1A]">
                          {tx(starter.prompt, THEME_STARTERS_EN[t.id].prompt)}
                        </span>
                        <span className="text-[11px] leading-snug text-[#6B7280]">
                          {tx(starter.hint, THEME_STARTERS_EN[t.id].hint)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Consult: show welcome + thread (hide raw welcome-only on mode home) */}
          {isConsult && !showModeHome
            ? messages.map((m, i) => (
                <div
                  key={m.id ?? `${m.role}-${i}`}
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                    m.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-[#F3F4F6] text-[#1A1A1A]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <AiChatStreamingRichText
                      text={m.content}
                      className="break-words"
                      animate={Boolean(m.id && m.id === streamingId)}
                      onTick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                      onComplete={() => setStreamingId((cur) => (cur === m.id ? null : cur))}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
              ))
            : null}

          {!isConsult && !excavateHome && session.phase !== "results"
            ? messages.map((m, i) => (
                <div
                  key={m.id ?? `${m.role}-${i}`}
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed ${
                    m.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-[#F3F4F6] text-[#1A1A1A]"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <AiChatStreamingRichText
                      text={m.content}
                      className="break-words"
                      animate={Boolean(m.id && m.id === streamingId)}
                      onTick={() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                      onComplete={() => setStreamingId((cur) => (cur === m.id ? null : cur))}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
              ))
            : null}

          {(isConsult || session.phase === "chat") && (sending || generating) ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {generating
                ? tx("アイデアを考えています…", "Thinking of ideas…")
                : tx("考え中…", "Thinking…")}
            </div>
          ) : null}

          {!isConsult && session.phase === "results" ? (
            <div className="mx-auto w-full max-w-xl space-y-4">
              <div>
                <h2 className="text-[17px] font-bold text-[#1A1A1A]">{tx("アイデアの種", "Idea seeds")}</h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  {tx(
                    "インタビューをもとに候補をまとめました。気になる種を深掘りしてみましょう。",
                    "We gathered candidates from the interview. Pick a seed to go deeper.",
                  )}
                </p>
              </div>

              {generating ? (
                <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tx("アイデアを考えています…", "Thinking of ideas…")}
                </div>
              ) : null}

              <ul className="space-y-3">
                {session.seeds.map((seed) => (
                  <li key={seed.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px]">
                    <p className="font-bold text-amber-900">{seed.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-amber-900/90">{seed.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handoffToCoach(seed)}
                        className="inline-flex min-h-[36px] items-center rounded-lg bg-violet-600 px-3 text-[12px] font-semibold text-white hover:bg-violet-500"
                      >
                        {tx("これを深掘りする", "Go deeper on this")}
                      </button>
                      {!isProject ? (
                        <button
                          type="button"
                          disabled={Boolean(savedSeedIds[seed.id]) || savingSeedId === seed.id}
                          onClick={() => void saveSeedToMyIdeas(seed)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"
                        >
                          {savingSeedId === seed.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : savedSeedIds[seed.id] ? (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {savedSeedIds[seed.id] ? tx("保存済み", "Saved") : tx("マイアイデアへ", "To My Ideas")}
                        </button>
                      ) : null}
                      <Link
                        href={matchingHref}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                      >
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {tx("仲間を探す", "Find teammates")}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              {!generating && session.seeds.length === 0 ? (
                <button
                  type="button"
                  onClick={() => void generateIdeas(session)}
                  className="text-sm font-semibold text-violet-700 hover:underline"
                >
                  {tx("もう一度生成する", "Generate again")}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setSession((s) => ({ ...s, phase: "chat" }))}
                className="text-[13px] font-semibold text-[#6B7280] hover:text-[#1A1A1A]"
              >
                {tx("← 会話に戻る", "← Back to chat")}
              </button>
            </div>
          ) : null}

          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <div ref={endRef} />
        </div>

        {isConsult || session.phase !== "results" ? (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="shrink-0 border-t border-[#E5E7EB] bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {!isConsult && session.phase === "chat" && session.userTurns >= 1 && !sending && !generating ? (
              <button
                type="button"
                onClick={() => void generateIdeas({ ...session, readyForIdeas: true })}
                className="mb-2 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-100"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {tx("この内容でアイデアの種を出す", "Generate idea seeds from this")}
              </button>
            ) : null}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending || generating}
                placeholder={
                  isConsult
                    ? tx("相談内容を入力…", "Type your question…")
                    : excavateHome
                      ? tx("モヤモヤしていることを書いてみる…", "Write what’s bothering you…")
                      : placeholder
                }
                className="min-h-[48px] flex-1 rounded-xl border border-[#E5E7EB] px-3 text-[15px] outline-none ring-violet-300 focus:ring-2 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || generating || !draft.trim()}
                className="min-h-[48px] shrink-0 rounded-xl bg-violet-600 px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("送信", "Send")}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {historyOpen ? (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tx("チャット履歴", "Chat history")}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="flex h-full w-[min(100%,320px)] flex-col bg-[#f7f7f8] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2">
              <p className="text-sm font-semibold text-[#111827]">{tx("チャット履歴", "Chat history")}</p>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6b7280] hover:bg-white"
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{historyRail}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
