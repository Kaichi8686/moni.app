"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceSlideShell } from "@/components/projects/workspace/WorkspaceSlideShell";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { loadFollowingListRecent } from "@/lib/profile/followActions";
import type { FollowListUser } from "@/lib/profile/types";
import { sendProjectInvite } from "@/lib/projects/projectInvites";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

function FriendAvatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const src = url?.trim() || null;
  const initial = name.trim().slice(0, 1) || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[13px] font-semibold text-zinc-500 ring-1 ring-zinc-200"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export default function WorkspaceInvite() {
  const { tx } = useI18n();
  const router = useRouter();
  const { project, projectId, loading, uid, canEdit } = useProjectWorkspace();
  const [friends, setFriends] = useState<FollowListUser[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");

  const memberIds = useMemo(
    () => new Set((project?.members ?? []).map((m) => m.id)),
    [project?.members],
  );

  const loadFriends = useCallback(async () => {
    if (!supabase || !uid) {
      setFriends([]);
      setFriendsLoading(false);
      return;
    }
    setFriendsLoading(true);
    try {
      const list = await loadFollowingListRecent(supabase, uid, 200);
      setFriends(
        list
          .filter((u) => !memberIds.has(u.id))
          .map((u) => ({
            ...u,
            avatarUrl: resolveMemberAvatarUrl(u.id, u.avatarUrl),
          })),
      );
    } finally {
      setFriendsLoading(false);
    }
  }, [uid, memberIds]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const selectedUsers = useMemo(() => {
    const map = new Map(friends.map((f) => [f.id, f]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as FollowListUser[];
  }, [friends, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q),
    );
  }, [friends, query]);

  function toggleUser(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function sendInvites() {
    if (!canEdit || selectedIds.length === 0) return;
    setSending(true);
    setErr("");
    setNotice("");
    try {
      let okCount = 0;
      const fails: string[] = [];
      for (const id of selectedIds) {
        const user = friends.find((f) => f.id === id);
        const res = await sendProjectInvite(projectId, id);
        if (res.ok) okCount += 1;
        else fails.push(user?.displayName ?? id.slice(0, 8));
      }
      if (okCount > 0) {
        setNotice(
          tx(
            `${okCount} 人を招待しました。お知らせに届きます。`,
            `Invited ${okCount} ${okCount === 1 ? "person" : "people"}.`,
          ),
        );
        setSelectedIds([]);
        await loadFriends();
      }
      if (fails.length > 0) {
        setErr(
          tx(
            `招待に失敗: ${fails.join("、")}`,
            `Couldn’t invite: ${fails.join(", ")}`,
          ),
        );
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) return <WorkspacePageSkeleton />;
  if (!project) return null;

  if (!canEdit) {
    return (
      <WorkspaceSlideShell
        title={tx("メンバーを招待", "Invite members")}
        onClose={() => router.push(`/projects/${projectId}/overview`)}
        contentClassName="px-4 pt-8"
      >
        <p className="text-center text-sm text-zinc-500">
          {tx("招待する権限がありません。", "You don’t have permission to invite.")}
        </p>
      </WorkspaceSlideShell>
    );
  }

  return (
    <WorkspaceSlideShell
      title={tx("メンバーを招待", "Invite members")}
      onClose={() => router.push(`/projects/${projectId}/overview`)}
      stickyBelowHeader={
        <div className="border-b border-zinc-100 bg-white px-4 pb-3 pt-3">
          {selectedUsers.length > 0 ? (
            <div className="-mx-1 mb-3 flex gap-3 overflow-x-auto px-1 pb-1 pt-1.5">
              {selectedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className="flex w-14 shrink-0 flex-col items-center gap-1"
                  aria-label={tx(`${u.displayName}の選択を解除`, `Deselect ${u.displayName}`)}
                >
                  <span className="relative">
                    <FriendAvatar name={u.displayName} url={u.avatarUrl} size={48} />
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF9600] text-white ring-2 ring-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-medium text-zinc-700">
                    {u.displayName}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx("友達の名前で検索", "Search friends by name")}
              className="h-11 w-full rounded-full border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-[15px] outline-none transition focus:border-[#FF9600] focus:bg-white focus:ring-2 focus:ring-[#FF9600]/20"
            />
          </label>
        </div>
      }
      contentClassName="px-0"
    >
      <div className="px-4 pt-3">
        {err ? (
          <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
            {err}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            {notice}
          </p>
        ) : null}
      </div>

      {friendsLoading ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          {query.trim()
            ? tx("一致する友達がいません。", "No matching friends.")
            : tx("招待できる友達がいません。", "No friends available to invite.")}
        </p>
      ) : (
        <ul>
          {filtered.map((u) => {
            const checked = selectedIds.includes(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100"
                >
                  <FriendAvatar name={u.displayName} url={u.avatarUrl} size={44} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-zinc-900">
                    {u.displayName}
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      checked
                        ? "border-[#FF9600] bg-[#FF9600] text-white"
                        : "border-zinc-300 bg-white text-transparent"
                    }`}
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-0 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm">
        <button
          type="button"
          disabled={sending || selectedIds.length === 0}
          onClick={() => void sendInvites()}
          className="w-full rounded-full bg-[#FF9600] py-3.5 text-[15px] font-semibold text-white transition active:opacity-90 disabled:opacity-40"
        >
          {sending
            ? tx("招待中…", "Inviting…")
            : selectedIds.length > 0
              ? tx(`${selectedIds.length}人を招待`, `Invite ${selectedIds.length}`)
              : tx("招待する", "Invite")}
        </button>
      </div>
    </WorkspaceSlideShell>
  );
}
