"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { LeagueBattleScreen } from "@/components/idea-league/LeagueBattleScreen";
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

export function IdeaLeagueApp({ embedded, hideChrome, onOpenGarden }: Props) {
  const { tx } = useI18n();
  const [me, setMe] = useState<MeIdentity | null>(null);
  const [profile, setProfile] = useState<LeagueProfileState | null>(null);
  const [battle, setBattle] = useState<LeagueBattleState | null>(null);
  const [publishedBattle, setPublishedBattle] = useState<LeagueBattleState | null>(null);
  const [err, setErr] = useState("");
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

    const current = await loadLeagueBattle(client, identity);
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

  // Resolve identity + first load. Do not clear existing profile (avoids skeleton flicker).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      try {
        let identity: MeIdentity = {
          userId: "local-guest",
          displayName: tx("あなた", "You"),
          avatarUrl: null,
        };
        if (supabase && supabaseEnabled) {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id;
          if (uid) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("display_name, username, avatar_url")
              .eq("id", uid)
              .maybeSingle();
            const row = (prof ?? {}) as Record<string, unknown>;
            identity = {
              userId: uid,
              displayName: String(row.display_name || row.username || tx("あなた", "You")),
              avatarUrl: (row.avatar_url as string | null) ?? null,
            };
          }
        }
        if (cancelled) return;
        setMe(identity);
        await reload(identity);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, tx]);

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
    if (err) {
      return shell(<p className="px-4 pt-6 text-center text-sm font-semibold text-rose-600">{err}</p>);
    }
    return shell(
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/70" />
        ))}
      </div>,
    );
  }

  if (!profile.tutorialCompleted) {
    return shell(
      <LeagueTutorialFlow
        onComplete={async (input) => {
          const client = supabaseEnabled ? supabase : null;
          return completeTutorial(client, me, input);
        }}
        onFinished={() => {
          void reload(me);
        }}
      />,
    );
  }

  const phase = sched.phase;
  const inBattle = phase === "submit" || phase === "vote" || phase === "results";

  if (inBattle && battle) {
    return shell(
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
      />,
    );
  }

  return shell(
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
    />,
  );
}
