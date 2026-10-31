"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
import { InterviewsComingSoon } from "@/components/idea-hub/InterviewsComingSoon";
import { WeeklyIdeaRitual } from "@/components/idea-hub/weekly/WeeklyIdeaRitual";
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
  const [ritualImmersive, setRitualImmersive] = useState(false);

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
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(true);
      setChatKey((k) => k + 1);
      replaceTab(mode === "consult" ? "qna" : "excavate");
    },
    [replaceTab],
  );

  const inAiChat = view === "chat";
  const hideChrome = inAiChat || ritualImmersive;

  return (
    <div className={`relative min-h-[100dvh] bg-white ${hideChrome ? "" : "pb-bottom-nav"}`}>
      {view === "mine" && !ritualImmersive ? (
        <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
            <AppBrandHeader bare />
          </div>
        </header>
      ) : null}

      {view === "board" || view === "interviews" ? (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
            <AppBrandHeader bare />
          </div>
        </header>
      ) : null}

      {view === "mine" ? <WeeklyIdeaRitual onImmersiveChange={setRitualImmersive} /> : null}

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
              className="mb-2 text-[13px] font-extrabold text-[#1CB0F6] hover:underline"
            >
              {tx("← アイデアに戻る", "← Back to ideas")}
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
              className="mb-2 text-[13px] font-extrabold text-[#1CB0F6] hover:underline"
            >
              {tx("← アイデアに戻る", "← Back to ideas")}
            </button>
          </div>
          <InterviewsComingSoon articles={INTERVIEW_ARTICLE_MOCKS} />
        </div>
      ) : null}

      {view === "mine" && !ritualImmersive ? (
        <button
          type="button"
          onClick={() => openAi("consult")}
          aria-label={tx("AIを開く", "Open AI")}
          className="fixed left-4 bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl border-b-4 border-[#1899D6] bg-[#1CB0F6] text-white transition active:translate-y-[3px] active:border-b-0 md:bottom-8"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      ) : null}

      {hideChrome ? null : <AppBottomNav />}
    </div>
  );
}

export function IdeaHub() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm font-bold text-[#777]">
          読み込み中…
        </div>
      }
    >
      <IdeaHubInner />
    </Suspense>
  );
}
