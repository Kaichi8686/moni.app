"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { fetchIncomingProjectInvites, fetchMyProjectNotifications } from "@/lib/projects/projectInvites";
import { countActionableFollowNotices } from "@/lib/profile/socialNotifications";
import { supabase } from "@/lib/supabase";

const ProjectInviteBellPanel = dynamic(
  () => import("@/components/projects/ProjectInviteBellPanel").then((m) => m.ProjectInviteBellPanel),
  { ssr: false },
);

type Props = {
  userId: string | null;
  onAccepted?: () => void;
};

export function ProjectNoticeBell({ userId, onAccepted }: Props) {
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState(0);
  const [toast, setToast] = useState("");

  const refreshBadge = useCallback(async (uid: string) => {
    const followCountPromise = supabase
      ? countActionableFollowNotices(supabase, uid)
      : Promise.resolve(0);
    const [invites, notes, followCount] = await Promise.all([
      fetchIncomingProjectInvites(uid),
      fetchMyProjectNotifications(uid, 40),
      followCountPromise,
    ]);
    const unreadNotes = notes.filter((n) => !n.read_at && n.type !== "project_invite").length;
    setBadge(invites.length + unreadNotes + followCount);
  }, []);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setBadge(0));
      return;
    }
    const ric = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let cancelIdle: (() => void) | undefined;
    if (ric.requestIdleCallback) {
      const idleId = ric.requestIdleCallback(() => {
        void refreshBadge(userId);
      }, { timeout: 1500 });
      cancelIdle = () => ric.cancelIdleCallback?.(idleId);
    } else {
      const timer = window.setTimeout(() => {
        void refreshBadge(userId);
      }, 0);
      cancelIdle = () => window.clearTimeout(timer);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshBadge(userId);
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshBadge(userId);
    }, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(poll);
      cancelIdle?.();
    };
  }, [userId, refreshBadge]);

  function flashToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        className="relative flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
        aria-label={badge > 0 ? `通知 ${badge}件` : "通知"}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Bell className="h-[20px] w-[20px]" strokeWidth={1.75} aria-hidden />
        {badge > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <ProjectInviteBellPanel
          open={open}
          onClose={() => {
            setOpen(false);
            void refreshBadge(userId);
          }}
          userId={userId}
          onAccepted={() => {
            onAccepted?.();
            void refreshBadge(userId);
          }}
          toast={flashToast}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </>
  );
}
