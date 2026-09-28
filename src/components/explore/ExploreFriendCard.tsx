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
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpenProfile}
        className="group flex aspect-square w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-3 text-center shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:opacity-90"
        aria-label={tx(`${member.name}のプロフィール`, `${member.name}'s profile`)}
      >
        {avatar}
        <p className="mt-2 line-clamp-1 w-full break-words [overflow-wrap:anywhere] text-[14px] font-semibold leading-tight text-zinc-900 sm:text-[15px]">
          {member.name}
        </p>
        <p className="mt-1 line-clamp-1 w-full break-words [overflow-wrap:anywhere] text-[11px] font-semibold leading-tight text-indigo-700 sm:text-[12px]">
          {member.strength}
        </p>
        <p className="mt-1.5 line-clamp-2 w-full break-words text-[11px] leading-snug text-zinc-500 sm:text-[12px]">
          {member.goal}
        </p>
      </button>
    </li>
  );
}
