"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { IdeaQnAPanel } from "@/components/idea-hub/IdeaQnAPanel";
import { MyIdeasPanel } from "@/components/idea-hub/MyIdeasPanel";
import { parseIdeaAiMode, parseIdeaHubTab, type IdeaAiMode } from "@/lib/idea-hub/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function IdeaHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx } = useI18n();
  const tab = parseIdeaHubTab(searchParams.get("tab"));
  const qnaBoard = tab === "qna" && searchParams.get("view") === "board";
  const aiFromQuery = parseIdeaAiMode(searchParams.get("ai"));

  const aiOpen = useMemo(() => {
    if (qnaBoard) return false;
    if (aiFromQuery) return true;
    // legacy tab deep links open the AI overlay
    return tab === "qna" || tab === "excavate";
  }, [aiFromQuery, qnaBoard, tab]);

  const aiMode: IdeaAiMode = useMemo(() => {
    if (aiFromQuery) return aiFromQuery;
    if (tab === "qna") return "consult";
    if (tab === "excavate") return "excavate";
    return "consult";
  }, [aiFromQuery, tab]);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `/idea?${qs}` : "/idea", { scroll: false });
    },
    [router, searchParams],
  );

  const openAi = useCallback(
    (mode: IdeaAiMode = "consult") => {
      replaceParams((params) => {
        params.delete("tab");
        params.delete("view");
        params.set("ai", mode);
      });
    },
    [replaceParams],
  );

  const closeAi = useCallback(() => {
    replaceParams((params) => {
      params.delete("ai");
      params.delete("tab");
      params.delete("view");
    });
  }, [replaceParams]);

  const setAiMode = useCallback(
    (mode: IdeaAiMode) => {
      replaceParams((params) => {
        params.delete("tab");
        params.delete("view");
        params.set("ai", mode);
      });
    },
    [replaceParams],
  );

  const closeBoard = useCallback(() => {
    replaceParams((params) => {
      params.delete("tab");
      params.delete("view");
      params.delete("ai");
    });
  }, [replaceParams]);

  return (
    <div className="min-h-[100dvh] bg-white pb-bottom-nav">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
        <div className="mx-auto max-w-lg">
          <AppBrandHeader bare className="px-4 pt-1 pb-2" />
        </div>
      </header>

      {qnaBoard ? (
        <div>
          <div className="mx-auto max-w-lg px-4 pt-3">
            <button
              type="button"
              onClick={closeBoard}
              className="mb-2 text-[13px] font-semibold text-violet-700 hover:underline"
            >
              {tx("← マイアイデアに戻る", "← Back to My ideas")}
            </button>
          </div>
          <IdeaQnAPanel active />
        </div>
      ) : (
        <MyIdeasPanel onOpenAi={() => openAi("excavate")} />
      )}

      {!aiOpen && !qnaBoard ? (
        <button
          type="button"
          onClick={() => openAi("consult")}
          className="fixed bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_4px_16px_rgba(0,0,0,0.22)] transition hover:bg-zinc-800 active:scale-95 md:bottom-8"
          aria-label={tx("AIに相談・発掘", "Open AI consult & discover")}
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      ) : null}

      {aiOpen ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-white"
          role="dialog"
          aria-modal="true"
          aria-label={tx("アイデアAI", "Ideas AI")}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={closeAi}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100"
              aria-label={tx("閉じる", "Close")}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <div
              role="tablist"
              aria-label={tx("AIモード", "AI mode")}
              className="grid min-h-[40px] flex-1 grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1"
            >
              {(
                [
                  { id: "consult" as const, label: tx("相談", "Chat") },
                  { id: "excavate" as const, label: tx("発掘", "Discover") },
                ] as const
              ).map((item) => {
                const active = aiMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAiMode(item.id)}
                    className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                      active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <IdeaInterviewApp variant="hub" initialMode={aiMode} fullscreen />
          </div>
        </div>
      ) : null}

      {aiOpen ? null : <AppBottomNav />}
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
