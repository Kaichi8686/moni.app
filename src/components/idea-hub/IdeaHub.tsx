"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
  const urlSpark = parseSparkMode(searchParams.get("spark"));

  /** URL と独立したローカル状態（切替を確実にする） */
  const [sparkMode, setSparkModeState] = useState<SparkMode>(urlSpark);
  const [gardenKey, setGardenKey] = useState(0);
  const [openHistoryOnChat, setOpenHistoryOnChat] = useState(false);
  const [startFreshOnChat, setStartFreshOnChat] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [gardenImmersive, setGardenImmersive] = useState(false);
  const [contestRoomId, setContestRoomId] = useState<string | null>(null);
  const [contestAutoSubmit, setContestAutoSubmit] = useState(false);

  useEffect(() => {
    setSparkModeState(urlSpark);
  }, [urlSpark]);

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
      setSparkModeState(mode);
      if (mode === "grow") setGardenKey((k) => k + 1);
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
    setContestRoomId(null);
    setContestAutoSubmit(false);
    setGardenImmersive(false);
    setSparkModeState("grow");
    setGardenKey((k) => k + 1);
    replaceParams((params) => {
      params.delete("tab");
      params.delete("view");
      params.delete("spark");
    });
  }, [replaceParams]);

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
  /** 花の没入中以外は常にトグル表示（コンテスト詳細中も花へ戻れる） */
  const showSparkToggle = view === "mine" && !gardenImmersive;

  const sparkToggle = showSparkToggle ? (
    <div
      role="tablist"
      aria-label={tx("モード切替", "Mode switch")}
      className="grid grid-cols-2 rounded-lg border border-zinc-200 bg-white/95 p-0.5 backdrop-blur"
    >
      <button
        type="button"
        role="tab"
        aria-selected={sparkMode === "grow"}
        onClick={() => setSparkMode("grow")}
        className={`min-h-9 rounded-md text-[13px] font-medium tracking-tight transition ${
          sparkMode === "grow" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800"
        }`}
      >
        {tx("花を育てる", "Grow")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={sparkMode === "contest"}
        onClick={() => setSparkMode("contest")}
        className={`min-h-9 rounded-md text-[13px] font-medium tracking-tight transition ${
          sparkMode === "contest" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800"
        }`}
      >
        {tx("コンテスト", "Contest")}
      </button>
    </div>
  ) : null;

  return (
    <div className={`relative min-h-[100dvh] bg-white ${hideBottomNav ? "" : "pb-bottom-nav"}`}>
      {/* コンテスト側: 通常ヘッダー + トグル */}
      {view === "mine" && sparkMode === "contest" ? (
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-2.5 pt-1">
            <AppBrandHeader bare />
            <div className="mt-2">{sparkToggle}</div>
          </div>
        </header>
      ) : null}

      {/* 花側: 元の全画面UIを壊さないよう、トグルは浮かせる */}
      {view === "mine" && sparkMode === "grow" && showSparkToggle ? (
        <div className="pointer-events-none fixed inset-x-0 top-[max(0.4rem,env(safe-area-inset-top))] z-40 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-sm">{sparkToggle}</div>
        </div>
      ) : null}

      {view === "board" || view === "interviews" ? (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
            <AppBrandHeader bare />
          </div>
        </header>
      ) : null}

      {view === "mine" && sparkMode === "grow" ? (
        <div className={showSparkToggle ? "pt-14" : undefined}>
          <IdeaGardenApp key={gardenKey} onImmersiveChange={setGardenImmersive} />
        </div>
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
              className="mb-2 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
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
              className="mb-2 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
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
          className="fixed left-4 bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] z-40 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-[var(--shadow-sm)] transition hover:border-zinc-300 hover:bg-zinc-50 md:bottom-8"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
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
