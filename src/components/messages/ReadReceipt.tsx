"use client";

import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";

type Reader = { id: string; displayName: string; avatarUrl?: string | null };

type Props = {
  readers: Reader[];
};

export function ReadReceipt({ readers }: Props) {
  if (readers.length === 0) return <span className="text-xs text-zinc-300">✓</span>;

  return (
    <div className="flex -space-x-1">
      {readers.slice(0, 3).map((user) => (
        <MemberAvatarBubble
          key={user.id}
          userId={user.id}
          name={user.displayName}
          avatarUrl={user.avatarUrl}
          size="sm"
          className="!h-3 !w-3 !text-[8px] ring-1 ring-white"
        />
      ))}
    </div>
  );
}
