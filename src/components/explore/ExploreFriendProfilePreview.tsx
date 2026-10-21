"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageCircle, Share2, UserPlus, UserCheck, UserMinus } from "lucide-react";
import { ExploreFriendProjectDetail } from "@/components/explore/ExploreFriendProjectDetail";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { countryLabel } from "@/lib/profile/countries";
import { genderLabel } from "@/lib/profile/gender";
import { interestFieldLabel } from "@/lib/profile/interestFields";
import { loadProfileView } from "@/lib/profile/profileData";
import {
  SKILL_PRESETS,
  TRAIT_PRESETS,
  displayTagLabel,
} from "@/lib/profile/skillsTraits";
import type { ProfileView } from "@/lib/profile/types";
import { profileUsername } from "@/lib/profile/username";
import { supabase } from "@/lib/supabase";

export type ExploreFriendPreviewMember = {
  id?: string;
  name: string;
  goal: string;
  strength: string;
  avatarUrl?: string | null;
  skills?: string[];
  traits?: string[];
  interestFields?: string[];
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

function BadgeSection({
  title,
  empty,
  tags,
  renderLabel,
  chipClassName,
}: {
  title: string;
  empty: string;
  tags: string[];
  renderLabel: (tag: string) => string;
  chipClassName: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-zinc-400">{title}</p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 8).map((tag) => (
            <span
              key={`${title}-${tag}`}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-medium ${chipClassName}`}
            >
              {renderLabel(tag)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-400">{empty}</p>
      )}
    </div>
  );
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
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [messageError, setMessageError] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  const avatarSrc = resolveMemberAvatarUrl(member.id, member.avatarUrl);
  const username = profile?.username ?? profileUsername(member.name, member.id ?? "guest");
  const followerCount = profile?.followerCount ?? 0;
  const bio = (profile?.bio ?? member.goal).trim();
  const displayName = profile?.displayName ?? member.name;
  const skills = profile?.skills?.length ? profile.skills : (member.skills ?? []);
  const traits = profile?.traits?.length ? profile.traits : (member.traits ?? []);
  const interestFields = profile?.interestFields?.length
    ? profile.interestFields
    : (member.interestFields ?? []);

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

  async function handleMessage() {
    if (!supabase || !member.id || messageLoading) return;
    setMessageError("");
    setMessageLoading(true);
    try {
      const result = await navigateToDirectMessage(supabase, router, member.id);
      if (result.ok) {
        onClose();
        return;
      }
      setMessageError(
        result.reason === "not_mutual"
          ? tx(
              "フォロー中の相手にメッセージできます",
              "You can message people you follow",
            )
          : tx("メッセージを開けませんでした。もう一度お試しください。", "Couldn’t open the chat. Try again."),
      );
    } finally {
      setMessageLoading(false);
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

        <div
          className={`flex w-full items-center gap-2 transition-[gap] duration-300 ease-out ${
            isFollowing ? "justify-between" : ""
          }`}
        >
          <button
            type="button"
            disabled={!member.id}
            onClick={onToggleFollow}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-full font-bold transition-all duration-300 ease-out active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${
              isFollowing
                ? "shrink-0 bg-white/18 px-3.5 text-[13px] text-white backdrop-blur-md ring-1 ring-white/25"
                : isPending
                  ? "w-full bg-white/18 px-5 text-[16px] text-white backdrop-blur-md ring-1 ring-white/25"
                  : "w-full bg-[#FFE600] px-5 text-[16px] text-zinc-950 shadow-[0_8px_24px_rgba(255,230,0,0.28)]"
            }`}
          >
            <AddIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.4} />
            <span className="whitespace-nowrap">{addLabel}</span>
          </button>
          {isFollowing && member.id ? (
            <button
              type="button"
              disabled={messageLoading}
              onClick={() => void handleMessage()}
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#FFE600] px-4 text-[15px] font-bold text-zinc-950 shadow-[0_8px_24px_rgba(255,230,0,0.28)] transition-all duration-300 ease-out active:scale-[0.985] disabled:opacity-60"
              aria-label={tx("メッセージ", "Message")}
            >
              <MessageCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={2.4} />
              <span className="truncate">
                {messageLoading ? tx("開いています…", "Opening…") : tx("メッセージ", "Message")}
              </span>
            </button>
          ) : null}
        </div>

        {messageError ? (
          <p className="mt-2 text-center text-xs font-medium text-rose-200">{messageError}</p>
        ) : null}
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
            {profile?.age != null ||
            profile?.country ||
            (profile?.gender && profile.gender !== "prefer_not") ||
            profile?.school ||
            profile?.location ? (
              <p className="text-sm text-zinc-500">
                {[
                  profile?.age != null ? tx(`${profile.age}歳`, `${profile.age} yrs`) : null,
                  profile?.gender && profile.gender !== "prefer_not"
                    ? genderLabel(profile.gender, locale)
                    : null,
                  profile?.country ? countryLabel(profile.country, locale) : null,
                  profile?.school,
                  profile?.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            <div className="space-y-3 pt-2">
              <BadgeSection
                title={tx("特技", "Skills")}
                empty={tx("まだ登録がありません", "Not set yet")}
                tags={skills}
                renderLabel={(tag) => displayTagLabel(tag, SKILL_PRESETS, locale)}
                chipClassName="border-zinc-200 bg-zinc-50 text-zinc-700"
              />
              <BadgeSection
                title={tx("興味", "Interests")}
                empty={tx("まだ登録がありません", "Not set yet")}
                tags={interestFields}
                renderLabel={(tag) => interestFieldLabel(tag, locale)}
                chipClassName="border-sky-200 bg-sky-50 text-sky-900"
              />
              <BadgeSection
                title={tx("性格", "Personality")}
                empty={tx("まだ登録がありません", "Not set yet")}
                tags={traits}
                renderLabel={(tag) => displayTagLabel(tag, TRAIT_PRESETS, locale)}
                chipClassName="border-violet-200 bg-violet-50 text-violet-800"
              />
            </div>
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
                  <li key={`peer-proj-${p.id}`}>
                    <button
                      type="button"
                      disabled={!p.id}
                      onClick={() => setOpenProjectId(p.id)}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3.5 text-left transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={tx(`${p.name}の詳細を見る`, `View details for ${p.name}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 font-semibold text-zinc-900">{p.name}</p>
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-zinc-200">
                            {p.visibility === "public" ? tx("公開", "Public") : tx("非公開", "Private")}
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                        {(p.description ?? "").trim() || tx("説明はまだありません。", "No description yet.")}
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-zinc-400">
                        {p.visibility === "public"
                          ? tx("タップして詳細を見る（閲覧のみ）", "Tap to view details (read-only)")
                          : tx("タップして確認（非公開はメンバーのみ）", "Tap to check (private: members only)")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {openProjectId ? (
        <ExploreFriendProjectDetail
          projectId={openProjectId}
          seed={
            openProject
              ? {
                  id: openProject.id,
                  name: openProject.name,
                  description: openProject.description,
                  visibility: openProject.visibility,
                }
              : null
          }
          onClose={() => setOpenProjectId(null)}
        />
      ) : null}
    </div>
  );
}
