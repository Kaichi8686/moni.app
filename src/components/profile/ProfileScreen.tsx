"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { BadgeRow } from "@/components/profile/BadgeRow";
import { computeMoniTier } from "@/lib/gamification/moniTier";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StoryHighlights } from "@/components/profile/StoryHighlights";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { syncUserBadges } from "@/lib/gamification/syncBadges";
import type { ProfileGamification } from "@/lib/gamification/profileGamification";
import {
  ensureProfileRow,
  hasPendingFollowRequest,
  isFollowingUser,
  loadFollowList,
  loadProfileProjects,
  loadProfileView,
} from "@/lib/profile/profileData";
import type { ProfileProjectHighlight, ProfileView } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

type Props = {
  userId?: string;
};

export function ProfileScreen({ userId: propUserId }: Props) {
  const router = useRouter();
  const { tx } = useI18n();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [projects, setProjects] = useState<ProfileProjectHighlight[]>([]);
  const [gamification, setGamification] = useState<ProfileGamification | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(() =>
    supabase ? "" : tx("Supabase が未設定です", "Supabase is not configured"),
  );

  const profileUserId = propUserId ?? viewerId;
  const isOwnProfile = Boolean(viewerId && profileUserId && viewerId === profileUserId);
  const authReadyRef = useRef(false);

  const loadProfileData = useCallback(
    async (targetId: string, uid: string | null) => {
      if (!supabase) {
        setError(tx("Supabase が未設定です", "Supabase is not configured"));
        return;
      }
      setError("");
      try {
        if (uid === targetId) {
          const ok = await ensureProfileRow(supabase, targetId);
          if (!ok) {
            setError(tx("プロフィールの初期化に失敗しました。再読み込みしてください。", "Could not initialize the profile. Please reload."));
            return;
          }
        }

        const view = await loadProfileView(supabase, targetId);
        if (!view) {
          setError(tx("プロフィールが見つかりません", "Profile not found"));
          return;
        }
        const [projectList, gam] = await Promise.all([
          loadProfileProjects(supabase, targetId),
          loadProfileGamification(supabase, targetId),
        ]);
        setProfile(view);
        setProjects(projectList);
        if (uid === targetId && gam.gamificationReady) {
          try {
            const synced = await syncUserBadges(supabase, targetId, gam.activityStreak, gam.badges);
            setGamification({ ...gam, badges: synced });
          } catch {
            setGamification(gam);
          }
        } else {
          setGamification(gam);
        }

        if (uid && uid !== targetId) {
          const [f, p] = await Promise.all([
            isFollowingUser(supabase, uid, targetId),
            hasPendingFollowRequest(supabase, uid, targetId),
          ]);
          setIsFollowing(f);
          setIsPending(p);
        } else {
          setIsFollowing(false);
          setIsPending(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Failed to load"));
      }
    },
    [tx],
  );

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    authReadyRef.current = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });

    const finishAuth = (uid: string | null) => {
      if (cancelled) return;
      authReadyRef.current = true;
      setViewerId(uid);
      const targetId = propUserId ?? uid;
      if (!targetId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      if (!uid && propUserId) {
        setLoading(false);
        return;
      }
      void loadProfileData(targetId, uid).finally(() => {
        if (!cancelled) setLoading(false);
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      finishAuth(session?.user.id ?? null);
    });

    const timeout = window.setTimeout(() => {
      if (cancelled || authReadyRef.current) return;
      authReadyRef.current = true;
      setLoading(false);
      setError(tx("読み込みがタイムアウトしました。ページを再読み込みしてください。", "Loading timed out. Please reload the page."));
    }, 15000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [propUserId, loadProfileData, tx]);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const targetId = propUserId ?? viewerId;
    if (!targetId) return;
    setLoading(true);
    setError("");
    await loadProfileData(targetId, viewerId);
    setLoading(false);
  }, [propUserId, viewerId, loadProfileData]);

  const loadFollowListCb = useCallback(
    (type: "followers" | "following") => {
      if (!supabase || !profile) return Promise.resolve([]);
      return loadFollowList(supabase, profile.id, type, viewerId);
    },
    [profile, viewerId],
  );

  const onToggleFollow = useCallback(
    async (targetId: string) => {
      if (!supabase || !viewerId) return;
      const following = await isFollowingUser(supabase, viewerId, targetId);
      if (following) {
        await supabase.from("follows").delete().eq("follower_id", viewerId).eq("following_id", targetId);
      } else {
        await supabase.from("follow_requests").insert({
          follower_id: viewerId,
          following_id: targetId,
          status: "pending",
        });
      }
      await reload();
    },
    [viewerId, reload],
  );

  if (!supabaseEnabled) {
    return (
      <div className="min-h-[100dvh] bg-white pb-bottom-nav text-zinc-900 antialiased">
        <AppBrandHeader className="border-zinc-200" />
        <p className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-zinc-600">
          {tx("Supabase 未接続です", "Supabase is not connected")}
        </p>
        <AppBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white pb-bottom-nav text-zinc-900 antialiased">
      <AppBrandHeader
        className="border-zinc-200"
        left={
          !isOwnProfile && propUserId ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg transition hover:bg-zinc-100"
              aria-label={tx("戻る", "Back")}
            >
              ←
            </button>
          ) : undefined
        }
        right={
          <Link
            href="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={tx("設定", "Settings")}
          >
            <Settings className="h-5 w-5" />
          </Link>
        }
      />

      {loading ? (
        <p className="px-4 py-12 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
      ) : error ? (
        <p className="px-4 py-12 text-center text-sm text-rose-600">{error}</p>
      ) : !viewerId && !propUserId ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-zinc-600">{tx("プロフィールを見るにはログインが必要です。", "Log in to view profiles.")}</p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-zinc-900 px-5 text-sm font-bold text-white transition hover:bg-zinc-800"
          >
            {tx("ログイン", "Log in")}
          </Link>
        </div>
      ) : profile ? (
        <div className="w-full">
          <ProfileHeader
            profile={profile}
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isPending={isPending}
            loadFollowList={loadFollowListCb}
            onToggleFollow={onToggleFollow}
            onFollowChange={() => void reload()}
            onAvatarUpdated={() => void reload()}
            viewerId={viewerId}
            profileUserId={profile.id}
            streakDays={
              gamification?.gamificationReady ? gamification.activityStreak : null
            }
            moniTier={
              gamification?.gamificationReady
                ? computeMoniTier({
                    projectCount: projects.length,
                    milestoneCount: 0,
                    streak: gamification.activityStreak,
                    badges: gamification.badges,
                  })
                : null
            }
          />
          {gamification?.gamificationReady ? <BadgeRow badges={gamification.badges} /> : null}
          {!gamification?.gamificationReady && isOwnProfile ? (
            <div className="mx-4 mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600 sm:mx-5">
              {tx("バッジ・ストリークを使うには Supabase で", "To use badges and streaks, run")}{" "}
              <code className="rounded bg-zinc-200/80 px-1 font-mono text-[11px]">apply_user_gamification.sql</code>{" "}
              {tx("を実行してください。", "in Supabase.")}
            </div>
          ) : null}

          <div className="border-t border-zinc-200 [animation:project-sheet-fade-in_180ms_ease]">
            <StoryHighlights projects={projects} isOwnProfile={isOwnProfile} />
          </div>
        </div>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
