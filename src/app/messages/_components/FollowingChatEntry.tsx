"use client";

import { ChevronRight } from "lucide-react";
import { StackedFollowAvatars } from "@/components/messages/StackedFollowAvatars";
import type { FollowListUser } from "@/lib/profile/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  recentFollowing: FollowListUser[];
  onOpen: () => void;
};

export function FollowingChatEntry({ recentFollowing, onOpen }: Props) {
  const { tx } = useI18n();
  const stacked = recentFollowing.slice(0, 2);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center px-4 py-3 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
    >
      <div className="relative mr-3 shrink-0">
        <StackedFollowAvatars
          users={stacked.map((u) => ({
            id: u.id,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
          }))}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {tx("フォロー中の人とチャット", "Chat with people you follow")}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {stacked.length === 0
            ? tx("フォローした人にメッセージできます", "Message people you follow")
            : tx("最近フォローした人から始める", "Start with people you recently followed")}
        </p>
      </div>
      <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-zinc-300" aria-hidden />
    </button>
  );
}
