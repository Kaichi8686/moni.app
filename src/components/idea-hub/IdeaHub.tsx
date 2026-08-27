"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppBottomNav } from "@/components/AppBottomNav";
import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { InterviewsComingSoon } from "@/components/idea-hub/InterviewsComingSoon";
import { MyIdeasPanel } from "@/components/idea-hub/MyIdeasPanel";
import { INTERVIEW_ARTICLE_MOCKS } from "@/lib/idea-hub/interviewMocks";
import { IDEA_HUB_TABS, parseIdeaHubTab, type IdeaHubTab } from "@/lib/idea-hub/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function IdeaHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tx, locale } = useI18n();
  const tab = parseIdeaHubTab(searchParams.get("tab"));

  const setTab = useCallback(
    (next: IdeaHubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "excavate") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/idea?${qs}` : "/idea", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="min-h-[100dvh] bg-white pb-bottom-nav">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white md:bg-white/95 md:backdrop-blur">
        <div className="mx-auto max-w-lg px-4 pt-3 pb-2">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="moni-wordmark text-[15px]">moni</p>
              <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">{tx("アイデア", "Ideas")}</h1>
            </div>
          </div>
          <div
            role="tablist"
            aria-label={tx("アイデア機能の切り替え", "Idea tools")}
            className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1"
          >
            {IDEA_HUB_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`min-h-[44px] rounded-lg px-1.5 py-2 text-[13px] font-semibold leading-snug transition sm:text-sm ${
                    active
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <span className="sm:hidden">{locale === "en" ? item.shortLabelEn : item.shortLabel}</span>
                  <span className="hidden sm:inline">{locale === "en" ? item.labelEn : item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div role="tabpanel">
        {tab === "excavate" ? <IdeaInterviewApp variant="hub" /> : null}
        {tab === "mine" ? <MyIdeasPanel onGoExcavate={() => setTab("excavate")} /> : null}
        {tab === "interviews" ? (
          <InterviewsComingSoon articles={INTERVIEW_ARTICLE_MOCKS} />
        ) : null}
      </div>

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
