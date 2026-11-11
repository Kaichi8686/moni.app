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
  /** When false, pause timers/fetches (keep mounted but hidden). Default true. */
  active?: boolean;
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

export function IdeaLeagueApp({
  embedded,
  hideChrome,
  onOpenGarden,
  active = true,
}: Props) {
  const { tx } = useI18n();
  const txRef = useRef(tx);
  txRef.current = tx;

  const aliveRef = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;

  const [me, setMe] = useState<MeIdentity | null>(null);
  const [profile, setProfile] = useState<LeagueProfileState | null>(null);
  const [battle, setBattle] = useState<LeagueBattleState | null>(null);
  const [publishedBattle, setPublishedBattle] = useState<LeagueBattleState | null>(null);
  const [err, setErr] = useState("");
  const [bootKey, setBootKey] = useState(0);
  const [tick, setTick] = useState(0);
  const bootedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Phase tick only while visible — avoids background work after leaving the tab.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (aliveRef.current) setTick((t) => t + 1);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [active]);

  const sched = scheduleFor();
  void tick;

  const reload = useCallback(async (identity: MeIdentity) => {
    const client = supabaseEnabled ? supabase : null;
    const p = await loadLeagueProfile(client, identity.userId);
    if (!aliveRef.current) return;
    setProfile(p);
    if (!p.tutorialCompleted) {
      setBattle(null);
      setPublishedBattle(null);
      return;
    }

    // Daily battles: always try to settle yesterday when today's round is live.
    await finalizeLeagueIfNeeded(client, identity);
    if (!aliveRef.current) return;
    {
      const refreshed = await loadLeagueProfile(client, identity.userId);
      if (!aliveRef.current) return;
      setProfile(refreshed);
    }
    const phase = scheduleFor().phase;

    // Skip heavy battle fetch while the tab is hidden.
    if (!activeRef.current) return;

    const current = await withTimeout(loadLeagueBattle(client, identity), 8_000);
    if (!aliveRef.current || !current) return;
    setBattle(current);

    const displayKey = current.displayResultsWeekKey;
    if (displayKey && displayKey !== current.week.weekKey) {
      const { loadLocalBattle } = await import("@/lib/idea-league/localStore");
      if (!aliveRef.current) return;
      setPublishedBattle(loadLocalBattle(identity, { weekKey: displayKey }));
    } else if (phase === "results") {
      setPublishedBattle(current);
    } else {
      setPublishedBattle(null);
    }
  }, []);

  // Boot once (or on explicit retry). Do not depend on `tx`.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!aliveRef.current) return;
      setErr("");
      const labelYou = () => txRef.current("あなた", "You");
      const guest: MeIdentity = {
        userId: "local-guest",
        displayName: labelYou(),
        avatarUrl: null,
      };

      try {
        const localProfile = await loadLeagueProfile(null, guest.userId);
        if (cancelled || !aliveRef.current) return;
        setMe(guest);
        setProfile(localProfile);

        let identity = guest;
        if (supabase && supabaseEnabled) {
          const auth = await withTimeout(supabase.auth.getUser(), 4_000);
          if (cancelled || !aliveRef.current) return;
          const uid = auth?.data.user?.id;
          if (uid) {
            const profRes = await withTimeout(
              supabase
                .from("profiles")
                .select("display_name, username, avatar_url")
                .eq("id", uid)
                .maybeSingle(),
              4_000,
            );
            if (cancelled || !aliveRef.current) return;
            const row = (profRes?.data ?? {}) as Record<string, unknown>;
            identity = {
              userId: uid,
              displayName: String(row.display_name || row.username || labelYou()),
              avatarUrl: (row.avatar_url as string | null) ?? null,
            };
          }
        }
        if (cancelled || !aliveRef.current) return;
        setMe(identity);
        bootedUserIdRef.current = identity.userId;
        await reload(identity);
      } catch (e) {
        if (cancelled || !aliveRef.current) return;
        setMe((prev) => prev ?? guest);
        setProfile((prev) => prev ?? localFallbackProfile(guest.userId));
        setErr(e instanceof Error ? e.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, bootKey]);

  // Soft refresh only while active and after first tick.
  useEffect(() => {
    if (!active || tick === 0 || !me) return;
    let cancelled = false;
    (async () => {
      try {
        await reload(me);
      } catch {
        /* keep frame */
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [tick, me, reload, active]);

  // When returning to the tab, refresh once (not on every me identity change).
  const wasActiveRef = useRef(active);
  useEffect(() => {
    const becameActive = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!becameActive || !me) return;
    if (bootedUserIdRef.current !== me.userId) return;
    let cancelled = false;
    (async () => {
      try {
        await reload(me);
      } catch {
        /* ignore */
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [active, me, reload]);

  const openGarden =
    onOpenGarden ??
    (() => {
      if (typeof window !== "undefined") window.location.href = "/idea";
    });

  const shell = (body: ReactNode) => (
    <div
      className={`relative min-h-[100dvh] bg-[#FAFAF9] ${
        embedded || hideChrome ? "" : "pb-bottom-nav"
      }`}
    >
      {hideChrome ? null : (
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-lg px-4 pb-2 pt-1">
            <AppBrandHeader bare />
            <p className="mt-1 text-center text-[11px] font-semibold tracking-[0.14em] text-zinc-500">
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
      me={{ userId: me.userId, displayName: me.displayName }}
      countdownActive={active}
      onSubmit={async (input) => {
        if (!aliveRef.current) return;
        const client = supabaseEnabled ? supabase : null;
        const next = await submitLeagueIdea(client, me, input);
        if (!aliveRef.current) return;
        setBattle(next);
      }}
      onVote={async (submissionId) => {
        if (!aliveRef.current) return;
        const client = supabaseEnabled ? supabase : null;
        const next = await castLeagueVote(client, me, submissionId);
        if (!aliveRef.current) return;
        setBattle(next);
      }}
    />
  ) : (
    <LeagueWaitingScreen
      profile={profile}
      userId={me.userId}
      displayName={me.displayName}
      currentPrompt={
        battle
          ? { title: battle.week.promptTitle, body: battle.week.promptBody }
          : undefined
      }
      publishedBattle={publishedBattle}
      countdownActive={active}
      onOpenGarden={openGarden}
      onSavePrompt={async (input) => {
        if (!aliveRef.current) return;
        const client = supabaseEnabled ? supabase : null;
        const next = await saveLeaguePromptFromSeed(client, me, input);
        if (!aliveRef.current) return;
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
