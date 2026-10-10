"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderKanban, Users, X } from "lucide-react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import {
  createGroupConversation,
  getOrCreateDirectConversation,
  getOrCreateProjectConversation,
} from "@/lib/messages/api";
import { loadFollowList } from "@/lib/profile/profileData";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  currentUserId: string;
  onClose: () => void;
  onCreated: () => void;
};

type Mode = "following" | "projects" | "group";

type UserRow = { id: string; display_name: string; avatar_url: string | null };
type ProjectRow = { id: string; name: string; icon?: string | null };

export function NewConversationModal({ currentUserId, onClose, onCreated }: Props) {
  const { tx } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("following");
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void (async () => {
      const list = await loadFollowList(client, currentUserId, "following", currentUserId);
      setFollowing(
        list.map((u) => ({
          id: u.id,
          display_name: u.displayName,
          avatar_url: u.avatarUrl,
        })),
      );

      const [{ data: owned }, { data: memberRows }] = await Promise.all([
        client.from("projects").select("id, name, icon").eq("owner_id", currentUserId).limit(40),
        client.from("project_members").select("project_id").eq("user_id", currentUserId).limit(40),
      ]);
      const memberIds = [...new Set((memberRows ?? []).map((r) => r.project_id as string))];
      let joined: ProjectRow[] = [];
      if (memberIds.length) {
        const { data } = await client.from("projects").select("id, name, icon").in("id", memberIds);
        joined = (data ?? []) as ProjectRow[];
      }
      const map = new Map<string, ProjectRow>();
      for (const p of [...((owned ?? []) as ProjectRow[]), ...joined]) map.set(p.id, p);
      setProjects([...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja")));
    })();
  }, [currentUserId]);

  const filteredFollowing = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return following;
    return following.filter((u) => u.display_name.toLowerCase().includes(q));
  }, [following, query]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const startDm = async (otherId: string) => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const convId = await getOrCreateDirectConversation(supabase, otherId);
    setLoading(false);
    if (convId) {
      onCreated();
      router.push(`/messages/${convId}`);
      return;
    }
    setError(tx("トークを開けませんでした", "Could not open chat"));
  };

  const openProjectLine = async (projectId: string) => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const convId = await getOrCreateProjectConversation(supabase, projectId);
    setLoading(false);
    if (convId) {
      onCreated();
      router.push(`/messages/${convId}`);
      return;
    }
    setError(tx("プロジェクトのグループラインを開けませんでした", "Could not open project group line"));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createFollowGroup = async () => {
    if (!supabase || selectedIds.size === 0) return;
    setLoading(true);
    setError("");
    const names = following.filter((u) => selectedIds.has(u.id)).map((u) => u.display_name);
    const defaultName =
      groupName.trim() ||
      (names.length <= 2 ? names.join("・") : `${names.slice(0, 2).join("・")} ほか`);
    const convId = await createGroupConversation(supabase, defaultName, [...selectedIds]);
    setLoading(false);
    if (convId) {
      onCreated();
      router.push(`/messages/${convId}`);
      return;
    }
    setError(tx("グループを作成できませんでした", "Could not create group"));
  };

  const modes: Array<{ key: Mode; label: string }> = [
    { key: "following", label: tx("フォロー中", "Following") },
    { key: "projects", label: tx("プロジェクト", "Projects") },
    { key: "group", label: tx("グループ作成", "New group") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-zinc-900">{tx("新しいメッセージ", "New message")}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b px-2 pt-2" role="tablist">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => {
                setMode(m.key);
                setQuery("");
                setError("");
              }}
              className={`relative min-h-[36px] flex-1 px-1 text-[12px] font-semibold transition sm:text-[13px] ${
                mode === m.key ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {m.label}
              {mode === m.key ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--brand,#ff5c35)]" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>

        {mode !== "projects" ? (
          <div className="border-b px-4 py-2">
            <input
              className="w-full rounded-xl bg-zinc-100 px-3 py-2 text-sm outline-none"
              placeholder={tx("名前で検索", "Search by name")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : (
          <div className="border-b px-4 py-2">
            <input
              className="w-full rounded-xl bg-zinc-100 px-3 py-2 text-sm outline-none"
              placeholder={tx("プロジェクト名で検索", "Search projects")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {error ? <p className="px-4 pt-2 text-xs text-rose-600">{error}</p> : null}

        {mode === "following" ? (
          <ul className="max-h-[50dvh] overflow-y-auto">
            {filteredFollowing.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                {tx("フォロー中の人がいません。検索タブから仲間を見つけましょう。", "You are not following anyone yet. Find people in Search.")}
              </li>
            ) : (
              filteredFollowing.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void startDm(u.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <MemberAvatarBubble
                      userId={u.id}
                      name={u.display_name}
                      avatarUrl={u.avatar_url}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-zinc-900">{u.display_name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {mode === "projects" ? (
          <ul className="max-h-[50dvh] overflow-y-auto">
            {filteredProjects.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                {tx("参加中のプロジェクトがありません。", "No projects yet.")}
              </li>
            ) : (
              filteredProjects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void openProjectLine(p.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg">
                      {p.icon?.trim() || <FolderKanban className="h-5 w-5 text-emerald-600" aria-hidden />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{p.name}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {tx("メンバー全員のグループライン", "Group line for all members")}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {mode === "group" ? (
          <div className="max-h-[50dvh] overflow-y-auto">
            <div className="space-y-2 border-b px-4 py-3">
              <label className="block text-xs font-semibold text-zinc-500" htmlFor="group-name">
                {tx("グループ名", "Group name")}
              </label>
              <input
                id="group-name"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                placeholder={tx("例: 週末チーム", "e.g. Weekend team")}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <p className="text-[11px] text-zinc-500">
                {tx("フォロー中の人から参加者を選んでください", "Pick people you follow")}
              </p>
            </div>
            <ul>
              {filteredFollowing.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-zinc-500">
                  {tx("フォロー中の人がいません。", "No followed people yet.")}
                </li>
              ) : (
                filteredFollowing.map((u) => {
                  const selected = selectedIds.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => toggleSelected(u.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                      >
                        <MemberAvatarBubble
                          userId={u.id}
                          name={u.display_name}
                          avatarUrl={u.avatar_url}
                          size="sm"
                        />
                        <span className="flex-1 text-sm font-medium text-zinc-900">{u.display_name}</span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                            selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 text-transparent"
                          }`}
                          aria-hidden
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="sticky bottom-0 border-t bg-white px-4 py-3">
              <button
                type="button"
                disabled={loading || selectedIds.size === 0}
                onClick={() => void createFollowGroup()}
                className="moni-btn-primary w-full gap-2 disabled:opacity-40"
              >
                <Users className="h-4 w-4" aria-hidden />
                {tx(
                  `グループを作成（${selectedIds.size}人）`,
                  `Create group (${selectedIds.size})`,
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
