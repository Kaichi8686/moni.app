"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
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

const EMPTY_PROJECTS: ProjectRow[] = [];

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
  eligibleProjects = EMPTY_PROJECTS,
  onAccepted,
  toast,
}: Props) {
  const [invites, setInvites] = useState<ProjectInviteRow[]>([]);
  const [notifications, setNotifications] = useState<ProjectNotificationRow[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [visible, setVisible] = useState(open);
  const [entered, setEntered] = useState(false);
  const projectsRef = useRef(eligibleProjects);
  projectsRef.current = eligibleProjects;

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
      for (const p of projectsRef.current) nameMap[p.id] = p.name;
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
        await markProjectNotificationsRead(unread);
        setNotifications((prev) =>
          prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      void loadInbox();
      return () => window.cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(timer);
  }, [open, loadInbox]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const otherNotes = useMemo(
    () => notifications.filter((n) => n.type !== "project_invite" && n.type !== "project_invite_resolved"),
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
    toast(action === "accept" ? "招待を承認しました" : "招待を拒否しました");
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    if (action === "accept") onAccepted?.();
    void loadInbox();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="通知">
      <button
        type="button"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        className={`project-notice-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-zinc-100 px-2 py-2.5 sm:px-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
            onClick={onClose}
          >
            <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            戻る
          </button>
          <h3 className="flex-1 pr-12 text-center text-base font-bold text-zinc-900">通知</h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
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
                            拒否
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
