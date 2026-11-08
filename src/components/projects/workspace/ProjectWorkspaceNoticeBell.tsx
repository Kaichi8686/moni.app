"use client";

import { Bell, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import {
  fetchWorkspaceNotifications,
  formatWorkspaceNotificationBody,
  markWorkspaceNotificationsRead,
  workspaceNotificationHref,
  type WorkspaceNotificationRow,
} from "@/lib/projects/workspaceNotifications";

type Props = {
  userId: string | null;
  projectId: string;
  disabled?: boolean;
};

export function ProjectWorkspaceNoticeBell({ userId, projectId, disabled }: Props) {
  const { tx, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [rows, setRows] = useState<WorkspaceNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  const refreshUnread = useCallback(async () => {
    if (!supabase || !userId || !projectId) {
      setHasUnread(false);
      return;
    }
    try {
      const list = await fetchWorkspaceNotifications(supabase, userId, projectId, 40);
      setHasUnread(list.some((row) => !row.read_at));
    } catch {
      setHasUnread(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    void refreshUnread();
    if (!userId || !projectId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnread();
    }, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
    };
  }, [projectId, refreshUnread, userId]);

  const loadPanel = useCallback(async () => {
    if (!supabase || !userId || !projectId) return;
    setLoading(true);
    try {
      const list = await fetchWorkspaceNotifications(supabase, userId, projectId, 50);
      setRows(list);
      const unreadIds = list.filter((row) => !row.read_at).map((row) => row.id);
      if (unreadIds.length > 0) {
        await markWorkspaceNotificationsRead(supabase, unreadIds);
        setRows((prev) =>
          prev.map((row) => (row.read_at ? row : { ...row, read_at: new Date().toISOString() })),
        );
        setHasUnread(false);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      void loadPanel();
      return () => window.cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(timer);
  }, [loadPanel, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[#374151] transition hover:bg-zinc-100/90 active:bg-zinc-200/80 disabled:opacity-50"
        aria-label={
          hasUnread
            ? tx("このプロジェクトの通知（未読あり）", "Project notifications (unread)")
            : tx("このプロジェクトの通知", "Project notifications")
        }
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        {hasUnread ? (
          <span
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden
          />
        ) : null}
      </button>

      {visible ? (
        <div
          className="fixed inset-0 z-[70]"
          role="dialog"
          aria-modal="true"
          aria-label={tx("プロジェクトの通知", "Project notifications")}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${
              entered ? "opacity-100" : "opacity-0"
            }`}
            aria-label={tx("閉じる", "Close")}
            onClick={() => {
              setOpen(false);
              void refreshUnread();
            }}
          />
          <div
            className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              entered ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-zinc-100 px-2 py-2.5 sm:px-3">
              <button
                type="button"
                className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
                onClick={() => {
                  setOpen(false);
                  void refreshUnread();
                }}
              >
                <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                {tx("戻る", "Back")}
              </button>
              <h3 className="flex-1 pr-12 text-center text-base font-bold text-zinc-900">
                {tx("通知", "Notifications")}
              </h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              {loading ? (
                <p className="py-8 text-center text-sm text-zinc-400">{tx("読み込み中…", "Loading…")}</p>
              ) : rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-500">
                  {tx("このプロジェクトの新しい通知はありません", "No notifications for this project yet")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2.5 text-left transition hover:bg-zinc-50"
                        onClick={() => {
                          setOpen(false);
                          if (row.project_id) {
                            router.push(workspaceNotificationHref(row.project_id, row.type));
                          }
                        }}
                      >
                        <p className="text-sm font-medium text-zinc-800">
                          {formatWorkspaceNotificationBody(row.type, row.body)}
                        </p>
                        <span className="mt-1 block text-[10px] text-zinc-400">
                          {new Date(row.created_at).toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
