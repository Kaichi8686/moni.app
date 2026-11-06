"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { ContestHeader } from "@/components/contest/ContestHeader";
import { IdeaDetailModal } from "@/components/contest/IdeaDetailModal";
import { IdeaGallery } from "@/components/contest/IdeaGallery";
import { IdeaSubmissionModal } from "@/components/contest/IdeaSubmissionModal";
import { loadActiveContest, loadContestById, loadContestIdeas, toggleIdeaLike } from "@/lib/contest/api";
import { DEMO_CONTEST, DEMO_CONTEST_SECONDARY, DEMO_IDEAS } from "@/lib/contest/demo";
import type { Contest, ContestGallerySort, ContestIdea } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { supabase, supabaseEnabled } from "@/lib/supabase";

function resolveDemoContest(id: string | null): Contest {
  if (id === DEMO_CONTEST_SECONDARY.id) return DEMO_CONTEST_SECONDARY;
  return DEMO_CONTEST;
}

type Props = {
  /** Ideaタブ内埋め込み（ナビ二重を避ける） */
  embedded?: boolean;
  contestId?: string | null;
  onBack?: () => void;
  /** 入室直後に投稿モーダルを開く */
  autoOpenSubmit?: boolean;
};

export function ContestApp({ embedded = false, contestId = null, onBack, autoOpenSubmit = false }: Props) {
  const { tx } = useI18n();
  const [uid, setUid] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [demo, setDemo] = useState(false);
  const [ideas, setIdeas] = useState<ContestIdea[]>([]);
  const [sort, setSort] = useState<ContestGallerySort>("popular");
  const [loading, setLoading] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [detail, setDetail] = useState<ContestIdea | null>(null);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const reloadGallery = useCallback(
    async (c: Contest, userId: string | null, nextSort: ContestGallerySort) => {
      if (!supabase) return;
      setGalleryLoading(true);
      try {
        const { ideas: rows, demo: isDemo } = await loadContestIdeas(supabase, c.id, userId, nextSort);
        setIdeas(rows);
        if (isDemo) setDemo(true);
        setDetail((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? prev : null));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "failed");
      } finally {
        setGalleryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!supabase || !supabaseEnabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const userId = data.session?.user.id ?? null;
        setUid(userId);
        const active = contestId
          ? await loadContestById(supabase, contestId)
          : await loadActiveContest(supabase);
        if (cancelled) return;
        setContest(active.contest);
        setDemo(active.demo);
        await reloadGallery(active.contest, userId, "popular");
        if (autoOpenSubmit && userId) setApplyOpen(true);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadGallery, contestId, autoOpenSubmit]);

  useEffect(() => {
    if (!contest || !supabase) return;
    void reloadGallery(contest, uid, sort);
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onToggleLike(idea: ContestIdea) {
    if (!uid) {
      setToast(tx("投票にはログインが必要です", "Sign in to upvote"));
      window.setTimeout(() => setToast(""), 2200);
      return;
    }

    const applyLocal = (liked: boolean, count: number) => {
      setIdeas((prev) => prev.map((e) => (e.id === idea.id ? { ...e, likedByMe: liked, likeCount: count } : e)));
      setDetail((prev) => (prev?.id === idea.id ? { ...prev, likedByMe: liked, likeCount: count } : prev));
    };

    if (demo || !supabase) {
      applyLocal(!idea.likedByMe, idea.likedByMe ? Math.max(0, idea.likeCount - 1) : idea.likeCount + 1);
      return;
    }

    const nextLiked = !idea.likedByMe;
    const nextCount = nextLiked ? idea.likeCount + 1 : Math.max(0, idea.likeCount - 1);
    applyLocal(nextLiked, nextCount);
    try {
      await toggleIdeaLike(supabase, uid, idea.id, idea.likedByMe);
    } catch (e) {
      applyLocal(idea.likedByMe, idea.likeCount);
      setToast(e instanceof Error ? e.message : "failed");
      window.setTimeout(() => setToast(""), 2200);
    }
  }

  function onApplyClick() {
    if (!uid) {
      setToast(tx("応募にはログインが必要です", "Sign in to enter"));
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setApplyOpen(true);
  }

  if (!supabaseEnabled) {
    const offlineContest = resolveDemoContest(contestId);
    return (
      <div className={`${embedded ? "min-h-0" : "min-h-[100dvh] pb-bottom-nav"} bg-zinc-50 text-zinc-900`}>
        {embedded ? (
          <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-9 items-center rounded-xl px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900"
            >
              ← {tx("ロビー", "Lobby")}
            </button>
          </div>
        ) : (
          <AppBrandHeader />
        )}
        <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 sm:px-5">
          <ContestHeader
            contest={offlineContest}
            ideaCount={DEMO_IDEAS.length}
            onApply={() => {
              setToast(tx("応募にはログインが必要です", "Sign in to enter"));
              window.setTimeout(() => setToast(""), 2200);
            }}
            demo
          />
          <IdeaGallery
            ideas={DEMO_IDEAS}
            sort={sort}
            onSortChange={setSort}
            onOpen={setDetail}
            onToggleLike={() => undefined}
            canLike={false}
          />
        </main>
        {toast ? (
          <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-[var(--shadow-md)]">
            {toast}
          </div>
        ) : null}
        {embedded ? null : <AppBottomNav />}
      </div>
    );
  }

  return (
    <div className={`${embedded ? "min-h-0" : "min-h-[100dvh] pb-bottom-nav"} bg-zinc-50 text-zinc-900`}>
      {embedded ? (
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-9 items-center rounded-xl px-2 text-[13px] font-medium text-zinc-600 transition hover:bg-white hover:text-zinc-900"
          >
            ← {tx("ロビー", "Lobby")}
          </button>
        </div>
      ) : (
        <AppBrandHeader
          left={
            <Link
              href={HOME_PROJECTS_HREF}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100"
              aria-label={tx("戻る", "Back")}
            >
              ←
            </Link>
          }
          right={
            <Link href="/discover" className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100">
              {tx("発見", "Discover")}
            </Link>
          }
        />
      )}

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 sm:px-5">
        {!embedded ? (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
              {tx("アイデアコンテスト", "Idea Contest")}
            </h1>
          </div>
        ) : null}

        {err ? <p className="text-sm text-rose-600">{err}</p> : null}

        {loading || !contest ? (
          <div className="space-y-3">
            <div className="h-48 animate-pulse rounded-xl border border-zinc-200 bg-white" />
            <div className="h-36 animate-pulse rounded-xl border border-zinc-200 bg-white" />
          </div>
        ) : (
          <>
            <ContestHeader contest={contest} ideaCount={ideas.length} onApply={onApplyClick} demo={demo} />
            <IdeaGallery
              ideas={ideas}
              sort={sort}
              onSortChange={setSort}
              onOpen={setDetail}
              onToggleLike={onToggleLike}
              loading={galleryLoading}
              canLike={Boolean(uid) || demo}
            />
          </>
        )}
      </main>

      {contest && uid ? (
        <IdeaSubmissionModal
          open={applyOpen}
          contest={contest}
          userId={uid}
          demo={demo}
          onClose={() => setApplyOpen(false)}
          onSubmitted={() => {
            setToast(tx("投稿しました！", "Posted!"));
            window.setTimeout(() => setToast(""), 2400);
            void reloadGallery(contest, uid, sort);
          }}
        />
      ) : null}

      <IdeaDetailModal
        idea={detail}
        onClose={() => setDetail(null)}
        onToggleLike={onToggleLike}
        canLike={Boolean(uid) || demo}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white shadow-[var(--shadow-md)]">
          {toast}
        </div>
      ) : null}

      {embedded ? null : <AppBottomNav />}
    </div>
  );
}
