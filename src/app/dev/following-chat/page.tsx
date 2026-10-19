"use client";

import { FollowingChatEntry } from "@/app/messages/_components/FollowingChatEntry";
import { StackedFollowAvatars } from "@/components/messages/StackedFollowAvatars";

const DEMO_USERS = [
  {
    id: "u1",
    displayName: "Sunset",
    username: "sunset",
    avatarUrl:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80",
    isFollowing: true,
    isPending: false,
  },
  {
    id: "u2",
    displayName: "Momo",
    username: "momo",
    avatarUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&q=80",
    isFollowing: true,
    isPending: false,
  },
];

export default function FollowingChatDevPage() {
  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto max-w-md border-x border-zinc-100">
        <h1 className="border-b px-4 py-3 text-sm font-semibold text-zinc-500">
          Following chat entry QA
        </h1>
        <div className="flex items-center gap-4 border-b px-4 py-4">
          <StackedFollowAvatars
            users={DEMO_USERS.map((u) => ({
              id: u.id,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
            }))}
          />
          <p className="text-sm text-zinc-600">Stacked avatars (2 most recent)</p>
        </div>
        <FollowingChatEntry recentFollowing={DEMO_USERS} onOpen={() => undefined} />
      </div>
    </main>
  );
}
