"use client";

import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";

type Props = {
  userId?: string;
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-11 w-11 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-[76px] w-[76px] text-[28px]",
};

export function MemberAvatarBubble({ userId, name, avatarUrl, size = "md", className = "" }: Props) {
  const src = resolveMemberAvatarUrl(userId, avatarUrl);
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const dim = sizeClass[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${dim} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-rose-300 to-indigo-400 font-bold uppercase text-white shadow-sm ring-2 ring-white ${dim} ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
