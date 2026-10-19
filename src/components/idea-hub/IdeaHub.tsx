"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
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
  /** AI full-screen defaults to 相談; excavate via the mode card. */
  const aiMode: IdeaPersonalAiMode = urlTab === "excavate" ? "excavate" : "consult";

  const [openHistoryOnChat, setOpenHistoryOnChat] = useState(false);
  const [startFreshOnChat, setStartFreshOnChat] = useState(false);
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
    setOpenHistoryOnChat(false);
    setStartFreshOnChat(false);
    replaceTab("mine");
  }, [replaceTab]);

  const openAi = useCallback(
    (mode: IdeaPersonalAiMode = "consult") => {
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(true);
      setChatKey((k) => k + 1);
      replaceTab(mode === "consult" ? "qna" : "excavate");
    },
    [replaceTab],
  );

  const setAiMode = useCallback(
    (mode: IdeaPersonalAiMode) => {
      // Switching 相談 / 発掘 should open a blank thread, not the last saved chat.
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(true);
      setChatKey((k) => k + 1);
      replaceTab(mode === "consult" ? "qna" : "excavate");
    },
    [replaceTab],
  );

  const inAiChat = view === "chat";

  return (
    <div className={`relative min-h-[100dvh] bg-white ${inAiChat ? "" : "pb-bottom-nav"}`}>
      {view === "mine" || view === "board" || view === "interviews" ? (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
            <AppBrandHeader bare />
          </div>
        </header>
      ) : null}

      {view === "mine" ? <MyIdeasPanel /> : null}

      {inAiChat ? (
        <IdeaInterviewApp
          key={`${aiMode}-${chatKey}`}
          variant="hub"
          initialMode={aiMode}
          onExit={goHome}
          onModeChange={setAiMode}
          openHistoryOnMount={openHistoryOnChat}
          startFreshOnMount={startFreshOnChat}
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

      {view === "mine" ? (
        <button
          type="button"
          onClick={() => openAi("consult")}
          aria-label={tx("AIを開く", "Open AI")}
          className="fixed left-4 bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:bg-violet-500 md:bottom-8"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      ) : null}

      {inAiChat ? null : <AppBottomNav />}
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
