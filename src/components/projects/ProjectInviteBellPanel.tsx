"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectRow } from "@/lib/projects/types";
import {
  fetchIncomingProjectInvites,
  fetchMyProjectNotifications,
  formatNotificationBody,
  markProjectNotificationsRead,
  respondProjectInvite,
  type ProjectInviteRow,
  type ProjectNotificationRow,
} from "@/lib/projects/projectInvites";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  eligibleProjects?: ProjectRow[];
  onAccepted?: () => void;
  toast: (message: string) => void;
};

export function ProjectInviteBellPanel({
  open,
  onClose,
  userId,
  eligibleProjects = [],
  onAccepted,
  toast,
}: Props) {
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);
  const [notifications, setNotifications] = useState<ProjectNotificationRow[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const [incoming, notes] = await Promise.all([
        fetchIncomingProjectInvites(userId),
        fetchMyProjectNotifications(userId),
      ]);
      setInvites(incoming);
      setNotifications(notes);

      const ids = [
        ...new Set([...incoming.map((i) => i.project_id), ...notes.map((n) => n.project_id).filter(Boolean)]),
      ] as string[];
      const nameMap: Record<string, string> = {};
      for (const p of eligibleProjects) nameMap[p.id] = p.name;
      const missing = ids.filter((id) => !nameMap[id]);
      if (missing.length > 0) {
        const { supabase } = await import("@/lib/supabase");
        if (supabase) {
          const { data } = await supabase.from("projects").select("id,name").in("id", missing);
          for (const row of data ?? []) {
            nameMap[row.id as string] = (row.name as string) || "プロジェクト";
          }
        }
      }
      setProjectNames(nameMap);

      const unread = notes.filter((n) => !n.read_at).map((n) => n.id);
      if (unread.length > 0) {
        void markProjectNotificationsRead(unread);
        setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
      }
    } finally {
      setLoading(false);
    }
  }, [userId, eligibleProjects]);

  useEffect(() => {
    if (!open) return;
    void loadInbox();
  }, [open, loadInbox]);

  const otherNotes = useMemo(
    () => notifications.filter((n) => n.type !== "project_invite"),
    [notifications],
  );

  async function onRespond(inviteId: string, action: "accept" | "decline") {
    setBusyId(inviteId);
    const res = await respondProjectInvite(inviteId, action);
    setBusyId(null);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    toast(action === "accept" ? "招待を承認しました" : "招待を辞退しました");
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    if (action === "accept") onAccepted?.();
    void loadInbox();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <h3 className="text-base font-bold text-zinc-900">通知</h3>
          <button type="button" className="text-sm text-zinc-500" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">読み込み中…</p>
          ) : (
            <div className="space-y-4">
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">プロジェクト招待</p>
                {invites.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-500">
                    届いている招待はありません
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {invites.map((inv) => (
                      <li key={inv.id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                        <p className="text-sm font-semibold text-zinc-900">
                          「{inv.project_name || projectNames[inv.project_id] || "プロジェクト"}」への招待
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {new Date(inv.created_at).toLocaleString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === inv.id}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            onClick={() => void onRespond(inv.id, "accept")}
                          >
                            承認する
                          </button>
                          <button
                            type="button"
                            disabled={busyId === inv.id}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 disabled:opacity-50"
                            onClick={() => void onRespond(inv.id, "decline")}
                          >
                            辞退
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">その他の通知</p>
                {otherNotes.length === 0 ? (
                  <p className="text-center text-xs text-zinc-400">まだありません</p>
                ) : (
                  <ul className="space-y-2">
                    {otherNotes.map((n) => (
                      <li key={n.id} className="rounded-xl border border-zinc-100 bg-white px-3 py-2.5 text-sm text-zinc-700">
                        {formatNotificationBody(n.type, n.body)}
                        <span className="mt-1 block text-[10px] text-zinc-400">
                          {new Date(n.created_at).toLocaleString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
