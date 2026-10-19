"use client";

import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";

export type StackedAvatarUser = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

type Props = {
  users: StackedAvatarUser[];
  className?: string;
};

/** Two overlapping circular avatars (back-left / front-right) with a white ring cutout. */
export function StackedFollowAvatars({ users, className = "" }: Props) {
  const back = users[0];
  const front = users[1];

  if (!back) {
    return (
      <div
        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 ${className}`}
        aria-hidden
      >
        <span className="text-lg font-semibold">+</span>
      </div>
    );
  }

  if (!front) {
    return (
      <div className={`relative h-14 w-14 shrink-0 ${className}`} aria-hidden>
        <MemberAvatarBubble
          userId={back.id}
          name={back.displayName}
          avatarUrl={back.avatarUrl}
          size="md"
        />
      </div>
    );
  }

  return (
    <div className={`relative h-14 w-[3.75rem] shrink-0 ${className}`} aria-hidden>
      <div className="absolute left-0 top-0 z-0">
        <MemberAvatarBubble
          userId={back.id}
          name={back.displayName}
          avatarUrl={back.avatarUrl}
          size="md"
          className="!ring-0 shadow-none"
        />
      </div>
      <div className="absolute bottom-0 right-0 z-10">
        <MemberAvatarBubble
          userId={front.id}
          name={front.displayName}
          avatarUrl={front.avatarUrl}
          size="md"
          className="!h-12 !w-12 !ring-[3px] !ring-white shadow-sm"
        />
      </div>
    </div>
  );
}
