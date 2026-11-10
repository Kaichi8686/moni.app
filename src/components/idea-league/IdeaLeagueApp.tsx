"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { LeagueBattleScreen } from "@/components/idea-league/LeagueBattleScreen";
import { LeagueErrorBoundary } from "@/components/idea-league/LeagueErrorBoundary";
import { LeagueTutorialFlow } from "@/components/idea-league/LeagueTutorialFlow";
import { LeagueWaitingScreen } from "@/components/idea-league/LeagueWaitingScreen";
import {
  castLeagueVote,
  completeTutorial,
  finalizeLeagueIfNeeded,
  loadLeagueBattle,
  loadLeagueProfile,
  saveLeaguePromptFromSeed,
  submitLeagueIdea,
  type MeIdentity,
} from "@/lib/idea-league/api";
import { scheduleFor } from "@/lib/idea-league/calendar";
import type { LeagueBattleState, LeagueProfileState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

type Props = {
  embedded?: boolean;
  hideChrome?: boolean;
  onOpenGarden?: () => void;
};

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise).catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function IdeaLeagueApp({ embedded, hideChrome, onOpenGarden }: Props) {
  const { tx } = useI18n();
  const txRef = useRef(tx);
  txRef.current = tx;

  const [me, setMe] = useState<MeIdentity | null>(null);
  const [profile, setProfile] = useState<LeagueProfileState | null>(null);
  const [battle, setBattle] = useState<LeagueBattleState | null>(null);
  const [publishedBattle, setPublishedBattle] = useState<LeagueBattleState | null>(null);
  const [err, setErr] = useState("");
  const [bootKey, setBootKey] = useState(0);
  // Re-render on a timer so scheduleFor() can advance phases without blanking the UI.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const sched = scheduleFor();
  void tick;

  const reload = useCallback(async (identity: MeIdentity) => {
    const client = supabaseEnabled ? supabase : null;
    const p = await loadLeagueProfile(client, identity.userId);
    setProfile(p);
    if (!p.tutorialCompleted) {
      setBattle(null);
      setPublishedBattle(null);
      return;
    }

    const phase = scheduleFor().phase;
    if (phase === "results") {
      await finalizeLeagueIfNeeded(client, identity);
      const refreshed = await loadLeagueProfile(client, identity.userId);
      setProfile(refreshed);
    }

    const current = await withTimeout(loadLeagueBattle(client, identity), 12_000);
    if (!current) return;
    setBattle(current);

    const displayKey = current.displayResultsWeekKey;
    if (displayKey && displayKey !== current.week.weekKey) {
      const { loadLocalBattle } = await import("@/lib/idea-league/localStore");
      setPublishedBattle(loadLocalBattle(identity, { weekKey: displayKey }));
    } else if (phase === "results") {
      setPublishedBattle(current);
    } else if (displayKey === current.week.weekKey && phase !== "submit") {
      setPublishedBattle(null);
    } else {
      setPublishedBattle(null);
    }
  }, []);

  // Boot: paint local profile immediately, then upgrade with auth / supabase.
  // Avoid depending on `tx` (re-runs cancel in-flight loads → infinite skeleton).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      const labelYou = () => txRef.current("あなた", "You");
      const guest: MeIdentity = {
        userId: "local-guest",
        displayName: labelYou(),
        avatarUrl: null,
      };

      try {
        // Instant first paint — never leave the skeleton waiting on the network.
        const localProfile = await loadLeagueProfile(null, guest.userId);
        if (cancelled) return;
        setMe(guest);
        setProfile(localProfile);

        let identity = guest;
        if (supabase && supabaseEnabled) {
          const auth = await withTimeout(supabase.auth.getUser(), 5_000);
          const uid = auth?.data.user?.id;
          if (uid) {
            const profRes = await withTimeout(
              supabase.from("profiles").select("display_name, username, avatar_url").eq("id", uid).maybeSingle(),
              5_000,
            );
            const row = (profRes?.data ?? {}) as Record<string, unknown>;
            identity = {
              userId: uid,
              displayName: String(row.display_name || row.username || labelYou()),
              avatarUrl: (row.avatar_url as string | null) ?? null,
            };
          }
        }
        if (cancelled) return;
        setMe(identity);
        await reload(identity);
      } catch (e) {
        if (cancelled) return;
        setMe((prev) => prev ?? guest);
        setProfile((prev) => prev ?? localFallbackProfile(guest.userId));
        setErr(e instanceof Error ? e.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, bootKey]);

  // Soft refresh on the phase timer only (skip tick=0 — boot effect owns first load).
  useEffect(() => {
    if (tick === 0 || !me) return;
    let cancelled = false;
    (async () => {
      try {
        await reload(me);
      } catch {
        // Keep last good frame; next tick retries.
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [tick, me, reload]);

  const openGarden =
    onOpenGarden ??
    (() => {
      if (typeof window !== "undefined") window.location.href = "/idea";
    });

  const shell = (body: ReactNode) => (
    <div
      className={`relative min-h-[100dvh] bg-gradient-to-b from-[#FFF8EF] via-[#F4F7FF] to-[#E8F7F0] ${
        embedded || hideChrome ? "" : "pb-bottom-nav"
      }`}
    >
      {hideChrome ? null : (
        <header className="sticky top-0 z-30 border-b border-zinc-100/80 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-2 pt-1">
            <AppBrandHeader bare />
            <p className="mt-1 text-center text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FF9600]">
              {tx("アイデアリーグ", "Idea League")}
            </p>
          </div>
        </header>
      )}
      {body}
      {embedded || hideChrome ? null : <AppBottomNav />}
    </div>
  );

  if (!me || !profile) {
    return shell(
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/70" />
        ))}
        {err ? (
          <div className="rounded-2xl bg-white/95 p-4 text-center ring-1 ring-rose-200">
            <p className="text-sm font-semibold text-rose-600">{err}</p>
            <button
              type="button"
              className="mt-3 text-sm font-extrabold text-[#FF9600]"
              onClick={() => setBootKey((k) => k + 1)}
            >
              {tx("再読み込み", "Retry")}
            </button>
          </div>
        ) : null}
      </div>,
    );
  }

  const phase = sched.phase;
  const inBattle = phase === "submit" || phase === "vote" || phase === "results";

  const body = !profile.tutorialCompleted ? (
    <LeagueTutorialFlow
      onComplete={async (input) => {
        const client = supabaseEnabled ? supabase : null;
        return completeTutorial(client, me, input);
      }}
      onFinished={() => {
        void reload(me);
      }}
    />
  ) : inBattle && battle ? (
    <LeagueBattleScreen
      battle={{ ...battle, phase }}
      publishedBattle={publishedBattle}
      onSubmit={async (input) => {
        const client = supabaseEnabled ? supabase : null;
        const next = await submitLeagueIdea(client, me, input);
        setBattle(next);
      }}
      onVote={async (submissionId) => {
        const client = supabaseEnabled ? supabase : null;
        const next = await castLeagueVote(client, me, submissionId);
        setBattle(next);
      }}
    />
  ) : (
    <LeagueWaitingScreen
      profile={profile}
      userId={me.userId}
      currentPrompt={
        battle
          ? { title: battle.week.promptTitle, body: battle.week.promptBody }
          : undefined
      }
      publishedBattle={publishedBattle}
      onOpenGarden={openGarden}
      onSavePrompt={async (input) => {
        const client = supabaseEnabled ? supabase : null;
        const next = await saveLeaguePromptFromSeed(client, me, input);
        setBattle(next);
      }}
    />
  );

  return shell(
    <LeagueErrorBoundary
      fallback={(retry, message) => (
        <div className="mx-auto max-w-lg px-4 pt-8 text-center">
          <p className="text-sm font-semibold text-rose-600">{message}</p>
          <button
            type="button"
            className="mt-3 text-sm font-extrabold text-[#FF9600]"
            onClick={() => {
              retry();
              setBootKey((k) => k + 1);
            }}
          >
            {tx("再読み込み", "Retry")}
          </button>
        </div>
      )}
    >
      {body}
    </LeagueErrorBoundary>,
  );
}

function localFallbackProfile(userId: string): LeagueProfileState {
  return {
    userId,
    tier: "bronze",
    tutorialCompleted: false,
    promotions: 0,
    highlight: false,
    history: [],
  };
}
