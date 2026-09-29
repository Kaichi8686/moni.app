"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { copyProjectInviteUrl, shareOrCopyProject } from "@/lib/projects/inviteLink";

type Props = {
  open: boolean;
  projectId: string;
  projectName: string;
  projectVisibility?: "public" | "private";
  currentUserId: string;
  onClose: () => void;
  toast: (message: string) => void;
};

/** プロジェクト内から開く招待シート（プロジェクト選択なし） */
export function ProjectInviteComposeModal({
  open,
  projectId,
  projectName,
  projectVisibility = "public",
  currentUserId,
  onClose,
  toast,
}: Props) {
  const [inviteUserQuery, setInviteUserQuery] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [inviteSearchBusy, setInviteSearchBusy] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const resetAndClose = useCallback(() => {
    setInviteUserQuery("");
    setInviteCandidates([]);
    setInviteBusyId(null);
    onClose();
  }, [onClose]);

  async function searchInviteUsers() {
    if (!supabase || !currentUserId) return;
    const q = inviteUserQuery.trim();
    if (q.length < 1) {
      setInviteCandidates([]);
      return;
    }
    setInviteSearchBusy(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name")
        .ilike("display_name", `%${q}%`)
        .neq("id", currentUserId)
        .limit(8);
      if (error) {
        toast(error.message);
        setInviteCandidates([]);
        return;
      }
      const { data: mems } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);
      const memberIds = new Set((mems ?? []).map((m: { user_id: string }) => m.user_id));
      setInviteCandidates(
        (data ?? [])
          .map((row) => ({
            id: row.id as string,
            name: ((row.display_name as string | null)?.trim() || "ユーザー") as string,
          }))
          .filter((row) => !memberIds.has(row.id)),
      );
    } finally {
      setInviteSearchBusy(false);
    }
  }

  async function inviteUser(inviteeId: string, inviteeName: string) {
    if (!supabase) return;
    setInviteBusyId(inviteeId);
    try {
      const { error } = await supabase.rpc("project_invite_member", {
        p_project_id: projectId,
        p_invitee_id: inviteeId,
      });
      if (error) {
        const msg = error.message ?? "";
        if (msg.includes("already a member")) toast("すでにメンバーです");
        else if (msg.includes("could not find") || msg.includes("schema cache") || msg.includes("does not exist")) {
          toast("DB未適用: apply_project_invite_notifications.sql を実行してください");
        } else toast(msg);
        return;
      }
      toast(`${inviteeName} さんを「${projectName}」に招待しました`);
      setInviteCandidates((prev) => prev.filter((c) => c.id !== inviteeId));
    } finally {
      setInviteBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={resetAndClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-zinc-900">招待</h3>
          <button type="button" className="text-sm text-zinc-500" onClick={resetAndClose}>
            閉じる
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          メンバーとして招待すると相手のお知らせに届きます。URL共有もできます。
        </p>
        <p className="mt-3 truncate rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900">
          {projectName}
        </p>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
          <p className="text-sm font-semibold text-zinc-900">ユーザーを招待</p>
          <p className="mt-1 text-[11px] text-zinc-500">表示名で検索して招待します。</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="表示名"
              value={inviteUserQuery}
              onChange={(e) => setInviteUserQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchInviteUsers();
                }
              }}
            />
            <button
              type="button"
              disabled={inviteSearchBusy || !inviteUserQuery.trim()}
              onClick={() => void searchInviteUsers()}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-60"
            >
              {inviteSearchBusy ? "検索中…" : "検索"}
            </button>
          </div>
          <ul className="mt-2 space-y-2">
            {inviteCandidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <span className="truncate text-sm font-medium text-zinc-900">{c.name}</span>
                <button
                  type="button"
                  disabled={inviteBusyId === c.id}
                  onClick={() => void inviteUser(c.id, c.name)}
                  className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {inviteBusyId === c.id ? "招待中…" : "招待する"}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-zinc-900">招待リンク</p>
          <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
            <p className="truncate text-sm font-semibold text-zinc-900">{projectName}</p>
            <p className="text-[11px] text-zinc-500">{projectVisibility === "public" ? "公開" : "非公開"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() =>
                  void (async () => {
                    const ok = await copyProjectInviteUrl(projectId);
                    toast(ok ? `「${projectName}」のURLをコピーしました` : "コピーに失敗しました");
                  })()
                }
              >
                URLをコピー
              </button>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800"
                onClick={() =>
                  void (async () => {
                    const r = await shareOrCopyProject(projectName, projectId);
                    if (r === "failed") toast("共有できませんでした");
                    else if (r === "copied") toast("テキストをコピーしました（共有メニューなし）");
                    else toast("共有パネルを開きました");
                  })()
                }
              >
                共有…
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
