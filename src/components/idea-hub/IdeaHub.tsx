"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { IdeaGardenApp } from "@/components/idea-garden/IdeaGardenApp";
import { IdeaLeagueApp } from "@/components/idea-league/IdeaLeagueApp";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
import { InterviewsComingSoon } from "@/components/idea-hub/InterviewsComingSoon";
import { INTERVIEW_ARTICLE_MOCKS } from "@/lib/idea-hub/interviewMocks";
import { parseIdeaHubTab, type IdeaHubTab } from "@/lib/idea-hub/types";
import type { IdeaPersonalAiMode } from "@/lib/idea-interview/personalAi";
import { useI18n } from "@/lib/i18n/I18nProvider";

type HubView = "mine" | "chat" | "board" | "interviews";
type SparkMode = "grow" | "league" | "ai";

function viewFromTab(tab: IdeaHubTab, board: boolean): HubView {
  if (board) return "board";
  if (tab === "interviews") return "interviews";
  if (tab === "excavate" || tab === "qna") return "chat";
  return "mine";
}

function parseSparkMode(raw: string | null, tab: IdeaHubTab): SparkMode {
  if (tab === "excavate" || tab === "qna") return "ai";
  // 旧 contest リンクはリーグへ寄せる
  if (raw === "league" || raw === "contest") return "league";
  return "grow";
}

function IdeaHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx } = useI18n();

  const urlTab = parseIdeaHubTab(searchParams.get("tab"));
  const qnaBoard = urlTab === "qna" && searchParams.get("view") === "board";
  const view = viewFromTab(urlTab, qnaBoard);
  const aiMode: IdeaPersonalAiMode = urlTab === "excavate" ? "excavate" : "consult";
  const urlSpark = parseSparkMode(searchParams.get("spark"), urlTab);

  /** URL と独立したローカル状態（切替を確実にする） */
  const [sparkMode, setSparkModeState] = useState<SparkMode>(urlSpark);
  const [gardenKey, setGardenKey] = useState(0);
  const [openHistoryOnChat, setOpenHistoryOnChat] = useState(false);
  const [startFreshOnChat, setStartFreshOnChat] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [gardenImmersive, setGardenImmersive] = useState(false);

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

  const openAi = useCallback(
    (mode: IdeaPersonalAiMode = "consult") => {
      setGardenImmersive(false);
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(true);
      setChatKey((k) => k + 1);
      setSparkModeState("ai");
      replaceParams((params) => {
        params.set("tab", mode === "consult" ? "qna" : "excavate");
        params.delete("view");
        params.delete("spark");
      });
    },
    [replaceParams],
  );

  const setSparkMode = useCallback(
    (mode: SparkMode) => {
      if (mode === "ai") {
        openAi("consult");
        return;
      }
      setGardenImmersive(false);
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(false);
      setSparkModeState(mode);
      if (mode === "grow") setGardenKey((k) => k + 1);
      replaceParams((params) => {
        params.delete("tab");
        params.delete("view");
        if (mode === "league") params.set("spark", "league");
        else params.delete("spark");
      });
    },
    [openAi, replaceParams],
  );

  const goHome = useCallback(() => {
    setSparkMode("grow");
  }, [setSparkMode]);

  const setAiMode = useCallback(
    (mode: IdeaPersonalAiMode) => {
      setOpenHistoryOnChat(false);
      setStartFreshOnChat(true);
      setChatKey((k) => k + 1);
      setSparkModeState("ai");
      replaceTab(mode === "consult" ? "qna" : "excavate");
    },
    [replaceTab],
  );

  const inAiChat = view === "chat";
  const hideBottomNav = inAiChat || (view === "mine" && gardenImmersive);
  /** 花の没入中以外はトグル表示 */
  const showSparkToggle = (view === "mine" && !gardenImmersive) || inAiChat;

  const sparkToggle = showSparkToggle ? (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100/95 p-1 shadow-sm ring-1 ring-zinc-200/80 backdrop-blur">
      <button
        type="button"
        onClick={() => setSparkMode("grow")}
        className={`min-h-11 rounded-xl px-1 text-[12px] font-extrabold tracking-tight transition sm:text-sm ${
          sparkMode === "grow" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        {tx("花", "Grow")}
      </button>
      <button
        type="button"
        onClick={() => setSparkMode("ai")}
        className={`min-h-11 rounded-xl px-1 text-[12px] font-extrabold tracking-tight transition sm:text-sm ${
          sparkMode === "ai" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        AI
      </button>
      <button
        type="button"
        onClick={() => setSparkMode("league")}
        className={`min-h-11 rounded-xl px-1 text-[12px] font-extrabold tracking-tight transition sm:text-sm ${
          sparkMode === "league" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        {tx("リーグ", "League")}
      </button>
    </div>
  ) : null;

  return (
    <div className={`relative min-h-[100dvh] bg-white ${hideBottomNav ? "" : "pb-bottom-nav"}`}>
      {(view === "mine" && sparkMode === "league") || inAiChat ? (
        <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-2 pt-1">
            {inAiChat ? null : <AppBrandHeader bare />}
            <div className={inAiChat ? undefined : "mt-1"}>{sparkToggle}</div>
          </div>
        </header>
      ) : null}

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

      {view === "mine" && sparkMode === "league" ? (
        <IdeaLeagueApp embedded hideChrome onOpenGarden={() => setSparkMode("grow")} />
      ) : null}

      {inAiChat ? (
        <IdeaInterviewApp
          key={`${aiMode}-${chatKey}`}
          variant="hub"
          initialMode={aiMode}
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
