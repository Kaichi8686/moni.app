"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, Camera, GraduationCap, MapPin } from "lucide-react";
import { ProfileActionButtons } from "@/components/profile/ProfileActionButtons";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileSkillsTraits } from "@/components/profile/ProfileSkillsTraits";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { MONI_TIER_META, type MoniTier } from "@/lib/gamification/moniTier";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import type { FollowListUser, ProfileView } from "@/lib/profile/types";

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

type Props = {
  profile: ProfileView;
  isOwnProfile: boolean;
  isFollowing: boolean;
  isPending: boolean;
  loadFollowList: (type: "followers" | "following") => Promise<FollowListUser[]>;
  onToggleFollow: (targetId: string) => Promise<void>;
  onFollowChange: () => void;
  onAvatarUpdated?: () => void;
  viewerId: string | null;
  moniTier?: MoniTier | null;
  profileUserId?: string;
  streakDays?: number | null;
};

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  isPending,
  loadFollowList,
  onToggleFollow,
  onFollowChange,
  onAvatarUpdated,
  viewerId,
  moniTier,
  profileUserId,
  streakDays,
}: Props) {
  const { tx } = useI18n();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const website = profile.website?.trim();
  const websiteLabel = website?.replace(/^https?:\/\//, "") ?? "";
  const tierMeta = moniTier ? MONI_TIER_META[moniTier] : null;

  async function handleAvatarUpload(file: File | null) {
    if (!file || !isOwnProfile || !supabase || !profile.id) return;
    setAvatarUploading(true);
    setAvatarError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error(tx("ログインが必要です", "Login required"));
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? tx("アップロードに失敗しました", "Upload failed"));
      setAvatarPreview(json.avatarUrl ?? null);
      onAvatarUpdated?.();
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : tx("写真の変更に失敗しました", "Couldn’t change photo"));
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  return (
    <div className="border-b border-zinc-200 bg-white px-4 pb-5 pt-5 sm:px-5">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <ProfileAvatar
            displayName={profile.displayName}
            avatarUrl={avatarPreview ?? profile.avatarUrl}
            size="xl"
          />
          {isOwnProfile ? (
            <>
              <input
                ref={avatarInputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(e) => void handleAvatarUpload(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
                aria-label={tx("プロフィール写真を変更", "Change profile photo")}
                title={tx("プロフィール写真を変更", "Change profile photo")}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <ProfileStats
            postCount={profile.postCount}
            followerCount={profile.followerCount}
            followingCount={profile.followingCount}
            profileId={profile.id}
            loadFollowList={loadFollowList}
            onToggleFollow={onToggleFollow}
            viewerId={viewerId}
            streakDays={streakDays}
          />
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900">
              {profile.displayName}
            </h1>
            {tierMeta ? (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-tight text-zinc-600">
                {tierMeta.label}
              </span>
            ) : null}
          </div>
          <p className="text-[13px] font-medium text-zinc-500">@{profile.username}</p>
        </div>

        {profile.bio ? (
          <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-zinc-700">{profile.bio}</p>
        ) : null}

        {profileUserId ? (
          <Link
            href={`/profile/${profileUserId}/portfolio`}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
          >
            {tx("ポートフォリオ", "Portfolio")}
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          </Link>
        ) : null}

        {website ? (
          <a
            href={website.startsWith("http") ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[13px] font-semibold text-zinc-900 underline-offset-2 hover:underline"
          >
            {websiteLabel}
          </a>
        ) : null}

        {profile.school || profile.location ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {profile.school ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                {profile.school}
              </span>
            ) : null}
            {profile.location ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-zinc-500">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {profile.location}
              </span>
            ) : null}
          </div>
        ) : null}

        <ProfileSkillsTraits skills={profile.skills ?? []} traits={profile.traits ?? []} />

        {avatarError ? <p className="text-xs text-rose-600">{avatarError}</p> : null}
        {avatarUploading ? <p className="text-xs text-zinc-500">{tx("写真をアップロード中…", "Uploading photo…")}</p> : null}

        <div className="pt-1">
          <ProfileActionButtons
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isPending={isPending}
            profileId={profile.id}
            onFollowChange={onFollowChange}
          />
        </div>
      </div>
    </div>
  );
}
