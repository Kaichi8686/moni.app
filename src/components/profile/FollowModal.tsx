"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { FollowListUser } from "@/lib/profile/types";

type Props = {
  type: "followers" | "following";
  profileId: string;
  viewerId: string | null;
  onClose: () => void;
  loadUsers: () => Promise<FollowListUser[]>;
  onToggleFollow: (targetId: string) => Promise<void>;
};

export function FollowModal({ type, profileId, viewerId, onClose, loadUsers, onToggleFollow }: Props) {
  const { tx } = useI18n();
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadUsers().then((list) => {
      if (!cancelled) {
        setUsers(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadUsers]);

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={tx("閉じる", "Close")} onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="mobile-content-inset flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-semibold">{type === "followers" ? tx("フォロワー", "Followers") : tx("フォロー中", "Following")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target inline-flex items-center justify-center text-lg text-gray-500"
            aria-label={tx("閉じる", "Close")}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">{tx("読み込み中…", "Loading…")}</p>
          ) : users.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              {type === "followers"
                ? tx("まだフォロワーはいません", "No followers yet")
                : tx("まだフォロー中のユーザーはいません", "Not following anyone yet")}
            </p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/profile/${user.id}`} onClick={onClose}>
                  <ProfileAvatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
                </Link>
                <Link href={`/profile/${user.id}`} className="min-w-0 flex-1" onClick={onClose}>
                  <p className="truncate text-sm font-semibold">{user.username}</p>
                  <p className="truncate text-xs text-gray-500">{user.displayName}</p>
                </Link>
                {viewerId && viewerId !== user.id && profileId !== user.id ? (
                  <button
                    type="button"
                    className={`inline-flex min-h-[44px] touch-manipulation items-center rounded-lg px-3 text-xs font-semibold ${
                      user.isFollowing
                        ? "bg-gray-100 text-gray-800"
                        : user.isPending
                          ? "bg-amber-100 text-amber-900"
                          : "bg-violet-600 text-white"
                    }`}
                    onClick={() => void onToggleFollow(user.id).then(() => void loadUsers().then(setUsers))}
                  >
                    {user.isFollowing
                      ? tx("フォロー中", "Following")
                      : user.isPending
                        ? tx("申請中", "Requested")
                        : tx("フォロー", "Follow")}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
