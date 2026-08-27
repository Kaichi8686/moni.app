"use client";

import { useState } from "react";
import { FollowModal } from "@/components/profile/FollowModal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { FollowListUser } from "@/lib/profile/types";

type Props = {
  postCount: number;
  followerCount: number;
  followingCount: number;
  profileId: string;
  loadFollowList: (type: "followers" | "following") => Promise<FollowListUser[]>;
  onToggleFollow: (targetId: string) => Promise<void>;
  viewerId: string | null;
  /** Optional Duolingo-like streak (fact label, no celebration). */
  streakDays?: number | null;
};

function formatStat(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function ProfileStats({
  postCount,
  followerCount,
  followingCount,
  profileId,
  loadFollowList,
  onToggleFollow,
  viewerId,
  streakDays,
}: Props) {
  const [modal, setModal] = useState<"followers" | "following" | null>(null);
  const { tx } = useI18n();

  const items = [
    { value: postCount, label: tx("投稿", "Posts"), onClick: undefined as undefined | (() => void) },
    { value: followerCount, label: tx("フォロワー", "Followers"), onClick: () => setModal("followers") },
    { value: followingCount, label: tx("フォロー中", "Following"), onClick: () => setModal("following") },
  ];

  return (
    <>
      <div className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 sm:gap-x-5">
        {items.map(({ value, label, onClick }) => {
          const inner = (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-[15px] font-semibold tabular-nums tracking-tight text-zinc-900">{formatStat(value)}</span>
              <span className="text-[12px] font-medium text-zinc-500">{label}</span>
            </span>
          );
          if (onClick) {
            return (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="min-h-[36px] touch-manipulation text-left transition hover:opacity-70"
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={label} className="min-h-[36px] flex items-center">
              {inner}
            </div>
          );
        })}
        {typeof streakDays === "number" ? (
          <div className="min-h-[36px] flex items-center">
            <span className="inline-flex items-baseline gap-1">
              <span className="text-[15px] font-semibold tabular-nums tracking-tight text-zinc-900">{streakDays}</span>
              <span className="text-[12px] font-medium text-zinc-500">{tx("日連続", "day streak")}</span>
            </span>
          </div>
        ) : null}
      </div>

      {modal ? (
        <FollowModal
          type={modal}
          profileId={profileId}
          viewerId={viewerId}
          onClose={() => setModal(null)}
          loadUsers={() => loadFollowList(modal)}
          onToggleFollow={onToggleFollow}
        />
      ) : null}
    </>
  );
}
