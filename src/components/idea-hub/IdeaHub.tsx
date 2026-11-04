"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { ContestApp } from "@/components/contest/ContestApp";
import { ContestLobby } from "@/components/contest/ContestLobby";
import { IdeaGardenApp } from "@/components/idea-garden/IdeaGardenApp";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
import { InterviewsComingSoon } from "@/components/idea-hub/InterviewsComingSoon";
import { INTERVIEW_ARTICLE_MOCKS } from "@/lib/idea-hub/interviewMocks";
import { parseIdeaHubTab, type IdeaHubTab } from "@/lib/idea-hub/types";
import type { IdeaPersonalAiMode } from "@/lib/idea-interview/personalAi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type HubView = "mine" | "chat" | "board" | "interviews";
type SparkMode = "grow" | "contest";

function viewFromTab(tab: IdeaHubTab, board: boolean): HubView {
  if (board) return "board";
  if (tab === "interviews") return "interviews";
  if (tab === "excavate" || tab === "qna") return "chat";
  return "mine";
}

function parseSparkMode(raw: string | null): SparkMode {
  return raw === "contest" ? "contest" : "grow";
}

function IdeaHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx } = useI18n();

  const urlTab = parseIdeaHubTab(searchParams.get("tab"));
  const qnaBoard = urlTab === "qna" && searchParams.get("view") === "board";
  const view = viewFromTab(urlTab, qnaBoard);
  const aiMode: IdeaPersonalAiMode = urlTab === "excavate" ? "excavate" : "consult";
  const sparkMode = parseSparkMode(searchParams.get("spark"));

  const [openHistoryOnChat, setOpenHistoryOnChat] = useState(false);
  const [startFreshOnChat, setStartFreshOnChat] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [gardenImmersive, setGardenImmersive] = useState(false);
  const [contestRoomId, setContestRoomId] = useState<string | null>(null);
  const [contestAutoSubmit, setContestAutoSubmit] = useState(false);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `/idea?${qs}` : "/idea", { scroll: false });
    },
    [router, searchParams],
  );

  const replaceTab = useCallback(
    (next: IdeaHubTab | null, opts?: { board?: boolean }) => {
      replaceParams((params) => {
        if (!next || next === "mine") {
          params.delete("tab");
          params.delete("view");
        } else {
          params.set("tab", next);
          if (opts?.board && next === "qna") params.set("view", "board");
          else params.delete("view");
        }
      });
    },
    [replaceParams],
  );

  const setSparkMode = useCallback(
    (mode: SparkMode) => {
      setContestRoomId(null);
      setContestAutoSubmit(false);
      setGardenImmersive(false);
      replaceParams((params) => {
        params.delete("tab");
        params.delete("view");
        if (mode === "contest") params.set("spark", "contest");
        else params.delete("spark");
      });
    },
    [replaceParams],
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
  const hideBottomNav = inAiChat || (view === "mine" && gardenImmersive);
  const showSparkToggle = view === "mine" && !gardenImmersive && !contestRoomId;

  return (
    <div className={`relative min-h-[100dvh] bg-white ${hideBottomNav ? "" : "pb-bottom-nav"}`}>
      {view === "mine" || view === "board" || view === "interviews" ? (
        gardenImmersive && view === "mine" ? null : (
          <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
            <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
              <AppBrandHeader bare />
              {showSparkToggle ? (
                <div className="mt-1 mb-2 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setSparkMode("grow")}
                    className={`min-h-11 rounded-xl text-sm font-extrabold tracking-tight transition ${
                      sparkMode === "grow"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {tx("花を育てる", "Grow a flower")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSparkMode("contest")}
                    className={`min-h-11 rounded-xl text-sm font-extrabold tracking-tight transition ${
                      sparkMode === "contest"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {tx("コンテスト", "Contest")}
                  </button>
                </div>
              ) : null}
            </div>
          </header>
        )
      ) : null}

      {view === "mine" && sparkMode === "grow" ? (
        <IdeaGardenApp onImmersiveChange={setGardenImmersive} />
      ) : null}

      {view === "mine" && sparkMode === "contest" ? (
        contestRoomId ? (
          <ContestApp
            embedded
            contestId={contestRoomId}
            autoOpenSubmit={contestAutoSubmit}
            onBack={() => {
              setContestRoomId(null);
              setContestAutoSubmit(false);
            }}
          />
        ) : (
          <ContestLobby
            onEnter={(id) => {
              setContestAutoSubmit(false);
              setContestRoomId(id);
            }}
            onCreate={(id) => {
              setContestAutoSubmit(true);
              setContestRoomId(id);
            }}
          />
        )
      ) : null}

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
              {tx("← アイデアの棚に戻る", "← Back to idea shelf")}
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
              {tx("← アイデアの棚に戻る", "← Back to idea shelf")}
            </button>
          </div>
          <InterviewsComingSoon articles={INTERVIEW_ARTICLE_MOCKS} />
        </div>
      ) : null}

      {view === "mine" && sparkMode === "grow" && !gardenImmersive ? (
        <button
          type="button"
          onClick={() => openAi("consult")}
          aria-label={tx("AIを開く", "Open AI")}
          className="fixed left-4 bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:bg-violet-500 md:bottom-8"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      ) : null}

      {hideBottomNav ? null : <AppBottomNav />}
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
