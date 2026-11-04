"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { ApplyContestModal } from "@/components/contest/ApplyContestModal";
import { ContestGallery } from "@/components/contest/ContestGallery";
import { ContestHeader } from "@/components/contest/ContestHeader";
import { loadActiveContest, loadContestEntries, toggleEntryLike } from "@/lib/contest/api";
import type { Contest, ContestEntry, ContestGallerySort } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HOME_PROJECTS_HREF } from "@/lib/navigation/homeProjects";
import { supabase, supabaseEnabled } from "@/lib/supabase";

export function ContestApp() {
  const { tx } = useI18n();
  const [uid, setUid] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [demo, setDemo] = useState(false);
  const [entries, setEntries] = useState<ContestEntry[]>([]);
  const [sort, setSort] = useState<ContestGallerySort>("popular");
  const [loading, setLoading] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const reloadGallery = useCallback(
    async (c: Contest, userId: string | null, nextSort: ContestGallerySort) => {
      if (!supabase) return;
      setGalleryLoading(true);
      try {
        const { entries: rows, demo: isDemo } = await loadContestEntries(supabase, c.id, userId, nextSort);
        setEntries(rows);
        if (isDemo) setDemo(true);
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
        const [{ data }, active] = await Promise.all([
          supabase.auth.getSession(),
          loadActiveContest(supabase),
        ]);
        if (cancelled) return;
        const userId = data.session?.user.id ?? null;
        setUid(userId);
        setContest(active.contest);
        setDemo(active.demo);
        await reloadGallery(active.contest, userId, "popular");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadGallery]);

  useEffect(() => {
    if (!contest || !supabase) return;
    void reloadGallery(contest, uid, sort);
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only when sort changes

  async function onToggleLike(entry: ContestEntry) {
    if (!uid) {
      setToast(tx("いいねにはログインが必要です", "Sign in to like"));
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    if (demo || !supabase) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                likedByMe: !e.likedByMe,
                likeCount: e.likedByMe ? Math.max(0, e.likeCount - 1) : e.likeCount + 1,
              }
            : e,
        ),
      );
      return;
    }

    const nextLiked = !entry.likedByMe;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              likedByMe: nextLiked,
              likeCount: nextLiked ? e.likeCount + 1 : Math.max(0, e.likeCount - 1),
            }
          : e,
      ),
    );
    try {
      await toggleEntryLike(supabase, uid, entry.id, entry.likedByMe);
    } catch (e) {
      setEntries((prev) =>
        prev.map((x) =>
          x.id === entry.id
            ? {
                ...x,
                likedByMe: entry.likedByMe,
                likeCount: entry.likeCount,
              }
            : x,
        ),
      );
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
    return <p className="p-8 text-center text-sm text-zinc-500">Supabase 未接続</p>;
  }

  return (
    <div className="min-h-[100dvh] bg-[#fafaf8] pb-bottom-nav text-zinc-900">
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
          <Link
            href="/discover"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
          >
            {tx("発見", "Discover")}
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {tx("コミュニティイベント", "Community event")}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">
            {tx("アイデアコンテスト", "Idea Contest")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {tx("1つの悩みに、解決ロードマップで競おう", "Compete with solution roadmaps for one challenge")}
          </p>
        </div>

        {err ? <p className="text-sm text-rose-600">{err}</p> : null}

        {loading || !contest ? (
          <div className="space-y-3">
            <div className="h-56 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        ) : (
          <>
            <ContestHeader contest={contest} onApply={onApplyClick} demo={demo} />
            <ContestGallery
              entries={entries}
              sort={sort}
              onSortChange={setSort}
              onToggleLike={onToggleLike}
              loading={galleryLoading}
              canLike={Boolean(uid) || demo}
            />
          </>
        )}
      </main>

      {contest && uid ? (
        <ApplyContestModal
          open={applyOpen}
          contest={contest}
          userId={uid}
          demo={demo}
          onClose={() => setApplyOpen(false)}
          onSubmitted={() => {
            setToast(tx("応募しました！", "Entry submitted!"));
            window.setTimeout(() => setToast(""), 2400);
            void reloadGallery(contest, uid, sort);
          }}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
