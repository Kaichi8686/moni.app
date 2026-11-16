"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceSlideShell } from "@/components/projects/workspace/WorkspaceSlideShell";
import { Avatar } from "@/components/ui/Avatar";
import { StackSkeleton, WorkspacePageSkeleton } from "@/components/ui/Skeleton";
import { logMemberJoinedActivity } from "@/lib/projects/projectActivity";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function roleLabel(role: Member["role"], tx: (ja: string, en: string) => string): string {
  if (role === "owner") return tx("オーナー", "Owner");
  if (role === "viewer") return tx("閲覧者", "Viewer");
  return tx("メンバー", "Member");
}

type JoinRequestRow = {
  id: string;
  requester_id: string;
  message: string;
  status: string;
};

type RequesterProfile = { name: string; avatarUrl: string | null };

export default function WorkspaceMembers() {
  const { tx } = useI18n();
  const router = useRouter();
  const { project, projectId, loading, uid, reload, refreshPendingJoinRequests } = useProjectWorkspace();
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, RequesterProfile>>({});
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [moderatorRolesLoaded, setModeratorRolesLoaded] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkRole() {
      if (!supabase || !uid || !projectId) {
        if (!cancelled) {
          setIsModerator(false);
          setModeratorRolesLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", uid)
        .maybeSingle();
      const role = (data as { role?: string } | null)?.role;
      if (!cancelled) {
        setIsModerator(role === "owner" || role === "admin");
        setModeratorRolesLoaded(true);
      }
    }
    void checkRole();
    return () => {
      cancelled = true;
    };
  }, [uid, projectId, project?.members]);

  const canReview = isModerator;

  const loadJoinRequests = useCallback(async () => {
    if (!supabase || !canReview) {
      setJoinRequests([]);
      return;
    }
    setRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_join_requests")
        .select("id,requester_id,message,status")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        setActionErr(error.message);
        setJoinRequests([]);
        return;
      }
      const rows = (data ?? []) as JoinRequestRow[];
      setJoinRequests(rows);
      void refreshPendingJoinRequests();
      const ids = [...new Set(rows.map((r) => r.requester_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url")
          .in("id", ids);
        const map: Record<string, RequesterProfile> = {};
        for (const p of profs ?? []) {
          map[p.id as string] = {
            name: ((p.display_name as string | null)?.trim() || "ユーザー") as string,
            avatarUrl: (p.avatar_url as string | null) ?? null,
          };
        }
        setRequesterProfiles(map);
      } else {
        setRequesterProfiles({});
      }
    } finally {
      setRequestsLoading(false);
    }
  }, [canReview, projectId, refreshPendingJoinRequests]);

  useEffect(() => {
    if (!moderatorRolesLoaded) return;
    void loadJoinRequests();
  }, [loadJoinRequests, moderatorRolesLoaded]);

  async function reviewJoinRequest(requestId: string, action: "accept" | "reject") {
    if (!supabase) return;
    setReviewBusyId(requestId);
    setActionErr("");
    setActionOk("");
    try {
      const { error } = await supabase.rpc("project_review_join_request", {
        p_request_id: requestId,
        p_action: action,
      });
      if (error) {
        setActionErr(error.message);
        return;
      }
      setActionOk(
        action === "accept"
          ? tx("参加申請を承認しました。", "Join request accepted.")
          : tx("参加申請を拒否しました。", "Join request rejected."),
      );
      if (action === "accept") {
        const row = joinRequests.find((r) => r.id === requestId);
        if (uid && row) {
          void logMemberJoinedActivity(supabase, {
            projectId,
            actorUserId: uid,
            memberUserId: row.requester_id,
            memberName: requesterProfiles[row.requester_id]?.name,
          });
        }
        try {
          const { getOrCreateProjectConversation } = await import("@/lib/messages/api");
          await getOrCreateProjectConversation(supabase, projectId);
        } catch {
          /* ignore */
        }
      }
      await loadJoinRequests();
      await refreshPendingJoinRequests();
      await reload();
    } finally {
      setReviewBusyId(null);
    }
  }

  function openProfile(userId: string) {
    router.push(`/profile/${userId}`);
  }

  if (loading) return <WorkspacePageSkeleton />;
  if (!project) return null;

  const showJoinRequests = canReview && (requestsLoading || joinRequests.length > 0);

  return (
    <WorkspaceSlideShell
      title={tx("メンバー", "Members")}
      onClose={() => router.push(`/projects/${projectId}/overview`)}
      contentClassName="px-4 pt-3"
    >
      {actionErr ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
          {actionErr}
        </p>
      ) : null}
      {actionOk ? (
        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          {actionOk}
        </p>
      ) : null}

      {showJoinRequests ? (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold tracking-wide text-zinc-500">
              {tx("参加申請", "Join requests")}
              {joinRequests.length > 0 ? (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4B4B] px-1.5 text-[11px] font-extrabold text-white">
                  {joinRequests.length}
                </span>
              ) : null}
            </h2>
          </div>
          <ul className="space-y-2">
            {requestsLoading ? (
              <li className="list-none">
                <StackSkeleton count={2} />
              </li>
            ) : null}
            {joinRequests.map((r) => {
              const profile = requesterProfiles[r.requester_id];
              const name = profile?.name ?? r.requester_id.slice(0, 8);
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => openProfile(r.requester_id)}
                  >
                    <Avatar name={name} url={profile?.avatarUrl ?? null} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-zinc-900">{name}</span>
                      <span className="mt-0.5 block text-[12px] text-zinc-500">
                        {r.message || tx("参加したいです", "I’d like to join")}
                      </span>
                    </span>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={reviewBusyId === r.id}
                      onClick={() => void reviewJoinRequest(r.id, "accept")}
                      className="flex-1 rounded-xl bg-[#FF9600] py-2 text-[12px] font-bold text-white shadow-[0_2px_0_#E08600] disabled:opacity-60"
                    >
                      {tx("承認", "Accept")}
                    </button>
                    <button
                      type="button"
                      disabled={reviewBusyId === r.id}
                      onClick={() => void reviewJoinRequest(r.id, "reject")}
                      className="flex-1 rounded-xl border border-zinc-200 bg-white py-2 text-[12px] font-bold text-zinc-700 disabled:opacity-60"
                    >
                      {tx("拒否", "Reject")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[13px] font-bold tracking-wide text-zinc-500">
          {tx("メンバー", "Members")}
          <span className="ml-2 font-semibold text-zinc-400">{project.members.length}</span>
        </h2>
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {project.members.map((m) => {
            const isSelf = Boolean(uid && m.id === uid);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100"
                  onClick={() => openProfile(m.id)}
                >
                  <Avatar name={m.name} url={m.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-zinc-900">
                      {m.name}
                      {isSelf ? (
                        <span className="ml-1 text-[11px] font-normal text-zinc-400">
                          {tx("（あなた）", "(you)")}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-zinc-500">{roleLabel(m.role, tx)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {project.members.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">
              {tx("メンバー情報を取得できませんでした。", "Couldn’t load members.")}
            </li>
          ) : null}
        </ul>
      </section>
    </WorkspaceSlideShell>
  );
}
