"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Share2, UserPlus, UserCheck, UserMinus } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { loadProfileView } from "@/lib/profile/profileData";
import type { ProfileView } from "@/lib/profile/types";
import { profileUsername } from "@/lib/profile/username";
import { supabase } from "@/lib/supabase";

export type ExploreFriendPreviewMember = {
  id?: string;
  name: string;
  goal: string;
  strength: string;
  avatarUrl?: string | null;
};

export type ExploreFriendPreviewProject = {
  id: string;
  name: string;
  description: string;
  visibility: string;
};

type Props = {
  member: ExploreFriendPreviewMember;
  projects: ExploreFriendPreviewProject[];
  projectsLoading: boolean;
  isFollowing: boolean;
  isPending: boolean;
  onClose: () => void;
  onToggleFollow: () => void;
};

function formatFollowerCount(n: number, locale: "ja" | "en"): string {
  return n.toLocaleString(locale === "ja" ? "ja-JP" : "en-US");
}

export function ExploreFriendProfilePreview({
  member,
  projects,
  projectsLoading,
  isFollowing,
  isPending,
  onClose,
  onToggleFollow,
}: Props) {
  const { tx, locale } = useI18n();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [shareNotice, setShareNotice] = useState("");

  const avatarSrc = resolveMemberAvatarUrl(member.id, member.avatarUrl);
  const username = profile?.username ?? profileUsername(member.name, member.id ?? "guest");
  const followerCount = profile?.followerCount ?? 0;
  const bio = (profile?.bio ?? member.goal).trim();
  const displayName = profile?.displayName ?? member.name;
  const skills = profile?.skills ?? [];
  const traits = profile?.traits ?? [];

  useEffect(() => {
    if (!supabase || !member.id) return;
    let cancelled = false;
    void loadProfileView(supabase, member.id).then((view) => {
      if (!cancelled) setProfile(view);
    });
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  useEffect(() => {
    if (!shareNotice) return;
    const t = window.setTimeout(() => setShareNotice(""), 2200);
    return () => window.clearTimeout(t);
  }, [shareNotice]);

  async function handleShare() {
    if (!member.id || typeof window === "undefined") return;
    const url = `${window.location.origin}/profile/${member.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: displayName,
          text: tx(`${displayName}のプロフィール`, `${displayName}'s profile`),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNotice(tx("リンクをコピーしました", "Link copied"));
    } catch {
      /* user cancelled share */
    }
  }

  const addLabel = !member.id
    ? tx("追加できません", "Can't add")
    : isFollowing
      ? tx("フォロー中", "Following")
      : isPending
        ? tx("リクエスト中", "Requested")
        : tx("追加", "Add");

  const AddIcon = isFollowing ? UserCheck : isPending ? UserMinus : UserPlus;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="peer-profile-title"
    >
      {/* Full-bleed hero */}
      <div className="absolute inset-0">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[18px] brightness-[0.72] saturate-[1.05]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_30%_20%,#5b4b3a_0%,#1c1917_55%,#09090b_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/80" />
      </div>

      {/* Top chrome */}
      <div className="relative z-20 flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(0.65rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95"
          onClick={onClose}
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95 disabled:opacity-40"
          onClick={() => void handleShare()}
          disabled={!member.id}
          aria-label={tx("共有", "Share")}
        >
          <Share2 className="h-5 w-5" strokeWidth={2.1} />
        </button>
      </div>

      {/* Spacer keeps hero dominant above the sheet */}
      <div className="relative z-10 min-h-0 flex-1" />

      {/* Bottom identity + CTA */}
      <div className="relative z-20 shrink-0 px-5 pb-3">
        <div className="mb-4 flex items-center gap-3.5">
          <MemberAvatarBubble
            userId={member.id}
            name={displayName}
            avatarUrl={member.avatarUrl}
            size="lg"
            className="!ring-2 !ring-white/90 shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="peer-profile-title"
              className="truncate text-[26px] font-bold leading-tight tracking-tight text-white drop-shadow-sm"
            >
              {displayName}
            </h2>
            <p className="mt-0.5 truncate text-[13px] font-medium text-white/85">
              {username}
              <span className="mx-1.5 text-white/55">·</span>
              {formatFollowerCount(followerCount, locale)}{" "}
              {tx("フォロワー", "Followers")}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!member.id}
          onClick={onToggleFollow}
          className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[16px] font-bold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${
            isFollowing || isPending
              ? "bg-white/18 text-white backdrop-blur-md ring-1 ring-white/25"
              : "bg-[#FFE600] text-zinc-950 shadow-[0_8px_24px_rgba(255,230,0,0.28)]"
          }`}
        >
          <AddIcon className="h-[18px] w-[18px]" strokeWidth={2.4} />
          {addLabel}
        </button>

        {shareNotice ? (
          <p className="mt-2 text-center text-xs font-medium text-white/80">{shareNotice}</p>
        ) : null}
        {!member.id ? (
          <p className="mt-2 text-center text-xs text-white/60">
            {tx("このユーザーはデモ表示のみです。", "This user is demo-only.")}
          </p>
        ) : null}
      </div>

      {/* Details sheet — always visible */}
      <div
        id="peer-profile-details"
        className="relative z-20 max-h-[52vh] overflow-hidden bg-white text-zinc-900"
      >
        <div className="flex justify-center border-b border-zinc-100 pt-2.5 pb-2">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>
        <div className="max-h-[calc(52vh-1.25rem)] overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3">
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {tx("プロフィール", "Profile")}
            </h3>
            <p className="text-[15px] leading-relaxed text-zinc-700">
              {bio || tx("自己紹介はまだありません。", "No bio yet.")}
            </p>
            {member.strength ? (
              <p className="text-sm font-medium text-zinc-500">
                {tx("強み", "Strength")}
                <span className="mx-1.5 text-zinc-300">·</span>
                <span className="text-zinc-800">{member.strength}</span>
              </p>
            ) : null}
            {profile?.school || profile?.location ? (
              <p className="text-sm text-zinc-500">
                {[profile.school, profile.location].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {skills.length || traits.length ? (
              <div className="space-y-2.5 pt-1">
                {skills.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">
                      {tx("特技", "Skills")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.slice(0, 8).map((skill) => (
                        <span
                          key={`skill-${skill}`}
                          className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {traits.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">
                      {tx("性格", "Traits")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {traits.slice(0, 8).map((trait) => (
                        <span
                          key={`trait-${trait}`}
                          className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-100"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {tx("参加中のプロジェクト", "Joined projects")}
            </h3>
            {projectsLoading ? (
              <p className="py-6 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
            ) : projects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-7 text-center text-sm leading-relaxed text-zinc-500">
                {member.id
                  ? tx(
                      "公開プロジェクトへの参加があればここに表示されます。",
                      "Public project memberships will show up here.",
                    )
                  : tx("デモユーザーのためプロジェクトは表示されません。", "Demo users have no projects.")}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {projects.map((p) => (
                  <li key={`peer-proj-${p.id}`} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 font-semibold text-zinc-900">{p.name}</p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                        {p.visibility === "public" ? tx("公開", "Public") : tx("非公開", "Private")}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                      {(p.description ?? "").trim() || tx("説明はまだありません。", "No description yet.")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
