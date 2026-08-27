"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookmarkPlus, Check, Loader2, ArrowUp, Sparkles, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createMyIdea } from "@/lib/idea-hub/myIdeas";
import { firstAssistantForTheme } from "@/lib/idea-interview/ruleEngine";
import {
  clearIdeaInterviewSession,
  emptySession,
  loadIdeaInterviewSession,
  saveIdeaInterviewSession,
} from "@/lib/idea-interview/session";
import {
  IDEA_INTERVIEW_HANDOFF_KEY,
  IDEA_INTERVIEW_THEMES,
  type IdeaInterviewHandoff,
  type IdeaInterviewMessage,
  type IdeaInterviewPhase,
  type IdeaInterviewSession,
  type IdeaInterviewTheme,
  type IdeaSeed,
  themeLabel,
} from "@/lib/idea-interview/types";

const THEME_STARTERS: Record<
  IdeaInterviewTheme,
  { prompt: string; hint: string }
> = {
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

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mobile virtual keyboard inset via Visual Viewport API */
function useKeyboardBottomInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(covered > 8 ? covered : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

function TypingDots() {
  const { tx } = useI18n();
  return (
    <div className="inline-flex items-center gap-1 px-1 py-0.5" aria-label={tx("入力中", "Typing")}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
    </div>
  );
}

type Props = {
  /** standalone = full page; hub = ideas tab excavate panel; project = workspace */
  variant?: "standalone" | "hub" | "project";
  projectId?: string;
};

export function IdeaInterviewApp({ variant = "standalone", projectId }: Props) {
  const { tx } = useI18n();
  const isProject = variant === "project" && Boolean(projectId);
  const isHub = variant === "hub";
  const exitHref = isProject ? `/projects/${projectId}/overview` : isHub ? "/idea" : "/";
  const deepDiveHref = isProject ? `/projects/${projectId}/coach` : "/?tab=mentor&mentor=ai";

  const [ready, setReady] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [session, setSession] = useState<IdeaInterviewSession>(emptySession);
  const [draft, setDraft] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [savingSeedId, setSavingSeedId] = useState<string | null>(null);
  const [savedSeedIds, setSavedSeedIds] = useState<Record<string, true>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const keyboardInset = useKeyboardBottomInset();

  const isHome = session.phase === "intro" || session.phase === "theme";
  const composerBottom =
    keyboardInset > 0 ? keyboardInset : "var(--bottom-nav-clearance)";

  useEffect(() => {
    const saved = loadIdeaInterviewSession();
    if (saved && (saved.phase === "chat" || saved.phase === "results" || saved.phase === "theme")) {
      setResumePrompt(true);
      setSession(saved);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || resumePrompt) return;
    if (session.phase === "intro" || session.phase === "theme") return;
    saveIdeaInterviewSession(session);
  }, [session, ready, resumePrompt]);

  useEffect(() => {
    if (session.phase !== "chat") return;
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [session.messages, sending, session.phase]);

  const setPhase = (phase: IdeaInterviewPhase) =>
    setSession((s) => ({ ...s, phase }));

  const startFresh = () => {
    clearIdeaInterviewSession();
    setSession(emptySession());
    setResumePrompt(false);
    setDraft("");
    setPlaceholder(tx("思いつく範囲でOKです", "Whatever comes to mind is fine"));
    setError("");
  };

  const continueSaved = () => {
    setResumePrompt(false);
  };

  const chooseTheme = (theme: IdeaInterviewTheme) => {
    const first = firstAssistantForTheme(theme);
    const msg: IdeaInterviewMessage = {
      id: uid(),
      role: "assistant",
      content: first.content,
    };
    setPlaceholder(first.placeholder);
    setError("");
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

  const generateIdeas = useCallback(async (next: IdeaInterviewSession) => {
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
      setError(tx("アイデアの生成に失敗しました。もう一度お試しください。", "Couldn’t generate ideas. Please try again."));
      setSession({ ...next, phase: "results", seeds: next.seeds });
    } finally {
      setGenerating(false);
    }
  }, [tx]);

  const sendAnswer = async () => {
    const text = draft.trim();
    if (!text || !session.theme || sending) return;
    setSending(true);
    setError("");
    const userMsg: IdeaInterviewMessage = { id: uid(), role: "user", content: text };
    const userTurns = session.userTurns + 1;
    const withUser: IdeaInterviewSession = {
      ...session,
      messages: [...session.messages, userMsg],
      userTurns,
    };
    setSession(withUser);
    setDraft("");

    try {
      const res = await fetch("/api/idea-interview/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme: session.theme,
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
      const assistantMsg: IdeaInterviewMessage = {
        id: uid(),
        role: "assistant",
        content: data.assistantMessage,
      };
      const next: IdeaInterviewSession = {
        ...withUser,
        messages: [...withUser.messages, assistantMsg],
        readyForIdeas: Boolean(data.readyForIdeas),
      };
      setSession(next);
      if (data.readyForIdeas) {
        await generateIdeas(next);
      }
    } catch {
      setError(tx("応答に失敗しました。通信状況を確かめてもう一度送ってください。", "Reply failed. Check your connection and try again."));
      setSession(withUser);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  /** ChatGPT-style: type first message without picking a theme chip → start as "other". */
  const startFromComposer = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const theme: IdeaInterviewTheme = "other";
    const first = firstAssistantForTheme(theme);
    const assistantMsg: IdeaInterviewMessage = {
      id: uid(),
      role: "assistant",
      content: first.content,
    };
    const userMsg: IdeaInterviewMessage = { id: uid(), role: "user", content: text };
    const withUser: IdeaInterviewSession = {
      ...emptySession(),
      phase: "chat",
      theme,
      messages: [assistantMsg, userMsg],
      userTurns: 1,
      updatedAt: new Date().toISOString(),
    };
    setPlaceholder(first.placeholder);
    setSession(withUser);
    setDraft("");
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/idea-interview/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme,
          userTurns: 1,
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
      const reply: IdeaInterviewMessage = {
        id: uid(),
        role: "assistant",
        content: data.assistantMessage,
      };
      const next: IdeaInterviewSession = {
        ...withUser,
        messages: [...withUser.messages, reply],
        readyForIdeas: Boolean(data.readyForIdeas),
      };
      setSession(next);
      if (data.readyForIdeas) {
        await generateIdeas(next);
      }
    } catch {
      setError(tx("応答に失敗しました。通信状況を確かめてもう一度送ってください。", "Reply failed. Check your connection and try again."));
      setSession(withUser);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
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

  // Matching feature not fully productized yet — keep a stub route + query for later wiring.
  const matchingHref = useMemo(() => {
    const theme = session.theme ?? "other";
    return `/discover?from=idea-interview&theme=${encodeURIComponent(theme)}`;
  }, [session.theme]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-white text-sm text-zinc-500">
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }

  if (resumePrompt) {
    return (
      <div
        className={`mx-auto flex max-w-lg flex-col justify-center gap-4 px-4 py-10 ${
          isProject ? "" : isHub ? "min-h-[50vh]" : "min-h-[calc(100dvh-var(--bottom-nav-clearance))]"
        }`}
      >
        {!isHub ? <p className="moni-wordmark text-xl">moni</p> : null}
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{tx("続きから再開しますか？", "Pick up where you left off?")}</h1>
        <p className="text-sm text-zinc-500">{tx("途中までのインタビューが保存されています。", "A saved interview is waiting.")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={continueSaved}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {tx("続きから", "Continue")}
          </button>
          <button
            type="button"
            onClick={startFresh}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            {tx("最初からやり直す", "Start over")}
          </button>
        </div>
        {!isHub ? (
          <Link href={exitHref} className="text-center text-sm text-zinc-500 hover:text-zinc-800">
            {isProject ? tx("プロジェクトに戻る", "Back to project") : tx("ホームに戻る", "Back to home")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-white text-zinc-900 ${
        isProject
          ? "min-h-[70vh]"
          : isHub
            ? "min-h-[calc(100dvh-var(--bottom-nav-clearance)-7.5rem)]"
            : "min-h-[calc(100dvh-var(--bottom-nav-clearance))]"
      }`}
    >
      {!isHub ? (
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            href={isHome ? exitHref : "#"}
            onClick={(e) => {
              if (isHome) return;
              e.preventDefault();
              if (session.phase === "results") setPhase("chat");
              else startFresh();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
            aria-label={tx("戻る", "Back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="moni-wordmark text-[15px]">moni</p>
            <p className="text-[13px] font-medium text-zinc-500">{tx("ビジネスアイデア発掘", "Business idea excavate")}</p>
          </div>
          {session.phase === "chat" || session.phase === "results" ? (
            <button
              type="button"
              onClick={startFresh}
              className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800"
            >
              {tx("新しい対話", "New chat")}
            </button>
          ) : null}
        </div>
      </header>
      ) : !isHome ? (
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3">
          <button
            type="button"
            onClick={() => {
              if (session.phase === "results") setPhase("chat");
              else startFresh();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
            aria-label={tx("戻る", "Back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-[13px] font-medium text-zinc-500">{tx("ビジネスアイデア発掘", "Business idea excavate")}</p>
          {session.phase === "chat" || session.phase === "results" ? (
            <button
              type="button"
              onClick={startFresh}
              className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-800"
            >
              {tx("新しい対話", "New chat")}
            </button>
          ) : (
            <span className="h-9 w-9" aria-hidden />
          )}
        </div>
      ) : null}

      {/* HOME — ChatGPT-style empty state + suggested prompts */}
      {isHome ? (
        <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6">
          <div className="flex flex-1 flex-col items-center justify-center px-2 pb-8 text-center">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Sparkles className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="text-[1.55rem] font-semibold tracking-tight text-zinc-950">
              {tx("何から話しますか？", "What should we talk about?")}
            </h1>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-zinc-500">
              {tx("日常のモヤモヤを聞くところから、ビジネスの種を一緒に探します。", "We’ll start from everyday frustrations and look for business seeds together.")}
            </p>

            <div className="mt-8 grid w-full max-w-md gap-2 sm:grid-cols-2">
              {IDEA_INTERVIEW_THEMES.map((t) => {
                const starter = THEME_STARTERS[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseTheme(t.id)}
                    className="rounded-2xl border border-zinc-200 bg-white px-3.5 py-3.5 text-left shadow-sm shadow-zinc-900/[0.02] transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99]"
                  >
                    <span className="block text-[15px] font-semibold leading-snug text-zinc-900">
                      {tx(starter.prompt, THEME_STARTERS_EN[t.id].prompt)}
                    </span>
                    <span className="mt-1.5 block text-[13px] leading-relaxed text-zinc-500">
                      {tx(starter.hint, THEME_STARTERS_EN[t.id].hint)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="mb-2 text-center text-sm text-red-600">{error}</p> : null}

          <div
            className="fixed inset-x-0 z-20 border-t border-zinc-100 bg-white px-3 py-2.5 md:bg-white/95 md:backdrop-blur"
            style={{ bottom: composerBottom }}
          >
            <div className="mx-auto flex max-w-lg items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={tx("モヤモヤしていることを書いてみる…", "Write what’s bothering you…")}
                disabled={sending}
                className="max-h-28 min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void startFromComposer();
                  }
                }}
              />
              <button
                type="button"
                disabled={!draft.trim() || sending}
                onClick={() => void startFromComposer()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                aria-label={tx("送信", "Send")}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </main>
      ) : null}

      {/* CHAT */}
      {session.phase === "chat" ? (
        <>
          <main
            className={`mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-4 ${
              isProject
                ? "pb-36"
                : "pb-[calc(8.5rem+var(--bottom-nav-clearance))]"
            }`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-500">
              {tx("テーマ", "Theme")}:{" "}
              {tx(
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
                )[session.theme ?? "other"] ?? "Everyday"
              )}
              {session.userTurns > 0 ? (
                <>
                  {" "}
                  · {tx("回答", "Answers")} {session.userTurns}
                </>
              ) : null}
            </p>
            <div className="flex flex-col gap-3">
              {session.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "rounded-br-md bg-sky-600 text-white"
                        : "rounded-bl-md border border-zinc-200 bg-zinc-50 text-zinc-800"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending || generating ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-zinc-200 bg-zinc-50 px-3.5 py-3">
                    <TypingDots />
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </main>

          <div
            className={`border-t border-zinc-200 bg-white px-3 pt-2 ${
              isProject ? "sticky bottom-0 pb-3" : "fixed inset-x-0 z-40 pb-3"
            }`}
            style={isProject ? undefined : { bottom: composerBottom }}
          >
            <div className="mx-auto flex max-w-lg flex-col gap-2">
              {session.userTurns >= 1 && !sending && !generating ? (
                <button
                  type="button"
                  onClick={() => void generateIdeas({ ...session, readyForIdeas: true })}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-[13px] font-semibold text-violet-800 transition hover:bg-violet-100"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {tx("この内容でアイデアの種を出す", "Generate idea seeds from this")}
                </button>
              ) : null}
              <p className="text-center text-[11px] text-zinc-400">
                {tx("深掘りしながら話しても、いつでも種出しに進めます", "Keep digging, or jump to seeds anytime")}
              </p>
              <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                disabled={sending || generating}
                className="min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendAnswer();
                  }
                }}
              />
              <button
                type="button"
                disabled={!draft.trim() || sending || generating}
                onClick={() => void sendAnswer()}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center self-end rounded-xl bg-zinc-900 px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("送信", "Send")}
              </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* RESULTS */}
      {session.phase === "results" ? (
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-16">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950">{tx("アイデアの種", "Idea seeds")}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {tx("インタビューをもとに候補をまとめました。気になる種を深掘りしてみましょう。", "We gathered candidates from the interview. Pick a seed to go deeper.")}
          </p>

          {generating ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tx("アイデアを考えています…", "Thinking of ideas…")}
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <ul className="mt-6 space-y-3">
            {session.seeds.map((seed) => (
              <li
                key={seed.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]"
              >
                <h2 className="text-[15px] font-semibold text-zinc-900">{seed.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{seed.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handoffToCoach(seed)}
                    className="inline-flex min-h-[36px] items-center rounded-md bg-sky-600 px-3 text-[12px] font-semibold text-white hover:bg-sky-500"
                  >
                    {tx("これを深掘りする", "Go deeper on this")}
                  </button>
                  {!isProject ? (
                    <button
                      type="button"
                      disabled={Boolean(savedSeedIds[seed.id]) || savingSeedId === seed.id}
                      onClick={() => void saveSeedToMyIdeas(seed)}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-default disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"
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
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {tx("仲間を探す", "Find teammates")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4">
            <p className="text-[13px] font-semibold text-zinc-800">{tx("一人だと難しそう？", "Too hard to do alone?")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              {tx(
                "同じテーマに関心がありそうな仲間とつながれます（マッチング機能は今後拡張予定）。",
                "You can connect with people who care about the same theme (matching will expand later).",
              )}
            </p>
            <Link
              href={matchingHref}
              className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              {tx("一緒にやる仲間を探す", "Find people to work with")}
            </Link>
          </div>

          {!generating && session.seeds.length === 0 ? (
            <button
              type="button"
              onClick={() => void generateIdeas(session)}
              className="mt-4 text-sm font-semibold text-sky-700 hover:underline"
            >
              {tx("もう一度生成する", "Generate again")}
            </button>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}
