"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ExploreFriendCardModel = {
  id?: string;
  name: string;
  goal: string;
  strength: string;
  avatarUrl?: string | null;
};

type Props = {
  member: ExploreFriendCardModel;
  avatar: ReactNode;
  onOpenProfile: () => void;
};

export function ExploreFriendCard({ member, avatar, onOpenProfile }: Props) {
  const { tx } = useI18n();
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm shadow-zinc-900/[0.03]">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpenProfile} className="shrink-0" aria-label={tx(`${member.name}のプロフィール`, `${member.name}'s profile`)}>
          {avatar}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpenProfile} className="w-full text-left">
            <p className="break-words text-[15px] font-semibold leading-snug text-zinc-900">{member.name}</p>
            <p className="mt-0.5 break-words text-[13px] font-medium text-zinc-500">{member.strength}</p>
            <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-zinc-600">{member.goal}</p>
          </button>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[14px] font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          {tx("プロフィール", "Profile")}
        </button>
      </div>
    </li>
  );
}
