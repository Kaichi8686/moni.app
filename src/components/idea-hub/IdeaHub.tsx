"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History, MessageCircle, Sparkles, X } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
import { IdeaAiHistorySheet } from "@/components/idea-hub/IdeaAiHistorySheet";
import { InterviewsComingSoon } from "@/components/idea-hub/InterviewsComingSoon";
import { MyIdeasPanel } from "@/components/idea-hub/MyIdeasPanel";
import { INTERVIEW_ARTICLE_MOCKS } from "@/lib/idea-hub/interviewMocks";
import { parseIdeaHubTab, type IdeaHubTab } from "@/lib/idea-hub/types";
import type { IdeaPersonalAiMode } from "@/lib/idea-interview/personalAi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type HubView = "mine" | "chat" | "board" | "interviews";

function viewFromTab(tab: IdeaHubTab, board: boolean): HubView {
  if (board) return "board";
  if (tab === "interviews") return "interviews";
  if (tab === "excavate" || tab === "qna") return "chat";
  return "mine";
}

function IdeaHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx } = useI18n();

  const urlTab = parseIdeaHubTab(searchParams.get("tab"));
  const qnaBoard = urlTab === "qna" && searchParams.get("view") === "board";
  const view = viewFromTab(urlTab, qnaBoard);
  const aiMode: IdeaPersonalAiMode = urlTab === "qna" ? "consult" : "excavate";

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openHistoryOnChat, setOpenHistoryOnChat] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  const replaceTab = useCallback(
    (next: IdeaHubTab | null, opts?: { board?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!next || next === "mine") {
        params.delete("tab");
        params.delete("view");
      } else {
        params.set("tab", next);
        if (opts?.board && next === "qna") params.set("view", "board");
        else params.delete("view");
      }
      const qs = params.toString();
      router.replace(qs ? `/idea?${qs}` : "/idea", { scroll: false });
    },
    [router, searchParams],
  );

  const goHome = useCallback(() => {
    setAiMenuOpen(false);
    setHistoryOpen(false);
    setOpenHistoryOnChat(false);
    replaceTab("mine");
  }, [replaceTab]);

  const openAiChat = useCallback(
    (mode: IdeaPersonalAiMode, opts?: { openHistory?: boolean }) => {
      setAiMenuOpen(false);
      setHistoryOpen(false);
      setOpenHistoryOnChat(Boolean(opts?.openHistory));
      setChatKey((k) => k + 1);
      replaceTab(mode === "consult" ? "qna" : "excavate");
    },
    [replaceTab],
  );

  const showMineChrome = view === "mine";
  const showHistoryInHeader = showMineChrome && aiMenuOpen;

  return (
    <div className="relative min-h-[100dvh] bg-white pb-bottom-nav">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
        <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
          <AppBrandHeader
            bare
            right={
              showHistoryInHeader ? (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {tx("履歴", "History")}
                </button>
              ) : undefined
            }
          />
        </div>
      </header>

      {view === "mine" ? (
        <MyIdeasPanel onGoExcavate={() => openAiChat("excavate")} />
      ) : null}

      {view === "chat" ? (
        <IdeaInterviewApp
          key={`${aiMode}-${chatKey}`}
          variant="hub"
          initialMode={aiMode}
          onExit={goHome}
          openHistoryOnMount={openHistoryOnChat}
        />
      ) : null}

      {view === "board" ? (
        <div>
          <div className="mx-auto max-w-lg px-4 pt-3">
            <button
              type="button"
              onClick={goHome}
              className="mb-2 text-[13px] font-semibold text-violet-700 hover:underline"
            >
              {tx("← マイアイデアに戻る", "← Back to My ideas")}
            </button>
          </div>
          <IdeaQnAPanel active />
        </div>
      ) : null}

      {view === "interviews" ? (
        <div>
          <div className="mx-auto max-w-lg px-4 pt-3">
            <button
              type="button"
              onClick={goHome}
              className="mb-2 text-[13px] font-semibold text-violet-700 hover:underline"
            >
              {tx("← マイアイデアに戻る", "← Back to My ideas")}
            </button>
          </div>
          <InterviewsComingSoon articles={INTERVIEW_ARTICLE_MOCKS} />
        </div>
      ) : null}

      {showMineChrome ? (
        <div className="pointer-events-none fixed right-4 bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] z-40 flex flex-col items-end gap-2 md:bottom-8">
          {aiMenuOpen ? (
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => openAiChat("excavate")}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 text-[14px] font-semibold text-sky-800 shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition hover:bg-sky-50"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {tx("発掘", "Discover")}
              </button>
              <button
                type="button"
                onClick={() => openAiChat("consult")}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 text-[14px] font-semibold text-violet-800 shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition hover:bg-violet-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {tx("相談", "Chat")}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setAiMenuOpen((open) => !open)}
            aria-expanded={aiMenuOpen}
            aria-label={aiMenuOpen ? tx("AIメニューを閉じる", "Close AI menu") : tx("AIを開く", "Open AI")}
            className={`pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition ${
              aiMenuOpen ? "bg-zinc-800 hover:bg-zinc-700" : "bg-violet-600 hover:bg-violet-500"
            }`}
          >
            {aiMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <span className="text-[13px] font-bold tracking-wide">AI</span>}
          </button>
        </div>
      ) : null}

      {historyOpen ? (
        <IdeaAiHistorySheet
          onClose={() => setHistoryOpen(false)}
          onSelect={(mode) => openAiChat(mode, { openHistory: true })}
        />
      ) : null}

      <AppBottomNav />
    </div>
  );
}

export function IdeaHub() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-zinc-500">
          読み込み中…
        </div>
      }
    >
      <IdeaHubInner />
    </Suspense>
  );
}
