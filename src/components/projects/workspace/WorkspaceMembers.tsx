"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ExploreFriendProfilePreview } from "@/components/explore/ExploreFriendProfilePreview";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceSlideShell } from "@/components/projects/workspace/WorkspaceSlideShell";
import { Avatar } from "@/components/ui/Avatar";
import { StackSkeleton, WorkspacePageSkeleton } from "@/components/ui/Skeleton";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { toggleFollowRelation } from "@/lib/profile/followActions";
import { hasPendingFollowRequest, isFollowingUser } from "@/lib/profile/profileData";
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

type PreviewMember = {
  id: string;
  name: string;
  goal: string;
  strength: string;
  avatarUrl?: string;
  skills: string[];
  interestFields: string[];
  traits: string[];
};

type PeerProject = {
  id: string;
  name: string;
  description: string;
  visibility: string;
};

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
  const [preview, setPreview] = useState<PreviewMember | null>(null);
  const [peerProjects, setPeerProjects] = useState<PeerProject[]>([]);
  const [peerProjectsLoading, setPeerProjectsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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
            avatarUrl: resolveMemberAvatarUrl(p.id as string, p.avatar_url as string | null),
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

  async function openProfile(userId: string, displayName: string, avatarUrl?: string | null) {
    const resolved = resolveMemberAvatarUrl(userId, avatarUrl) ?? undefined;
    setPreview({
      id: userId,
      name: displayName,
      goal: "",
      strength: "",
      avatarUrl: resolved,
      skills: [],
      interestFields: [],
      traits: [],
    });
    setPeerProjects([]);
    setPeerProjectsLoading(true);
    setIsFollowing(false);
    setIsPending(false);

    if (!supabase || !uid) {
      setPeerProjectsLoading(false);
      return;
    }

    try {
      const [following, pending, memberships, profile] = await Promise.all([
        isFollowingUser(supabase, uid, userId),
        hasPendingFollowRequest(supabase, uid, userId),
        supabase
          .from("project_members")
          .select("project_id, projects(id, name, description, visibility)")
          .eq("user_id", userId)
          .limit(12),
        supabase
          .from("profiles")
          .select("display_name, username, bio, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      setIsFollowing(following);
      setIsPending(pending);

      const projects: PeerProject[] = [];
      for (const row of memberships.data ?? []) {
        const p = row.projects as
          | { id?: string; name?: string; description?: string | null; visibility?: string }
          | { id?: string; name?: string; description?: string | null; visibility?: string }[]
          | null;
        const proj = Array.isArray(p) ? p[0] : p;
        if (!proj?.id) continue;
        projects.push({
          id: proj.id,
          name: proj.name ?? "",
          description: proj.description ?? "",
          visibility: proj.visibility ?? "public",
        });
      }
      setPeerProjects(projects);

      if (profile.data) {
        const p = profile.data;
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                name:
                  ((p.display_name as string) || (p.username as string) || prev.name).trim() ||
                  prev.name,
                goal: ((p.bio as string) || "").trim(),
                avatarUrl:
                  resolveMemberAvatarUrl(userId, (p.avatar_url as string) || avatarUrl) ??
                  prev.avatarUrl,
              }
            : prev,
        );
      }
    } finally {
      setPeerProjectsLoading(false);
    }
  }

  async function onToggleFollow() {
    if (!supabase || !uid || !preview?.id || preview.id === uid) return;
    const res = await toggleFollowRelation(supabase, uid, preview.id);
    if (!res.ok) return;
    if (res.state === "following") {
      setIsFollowing(true);
      setIsPending(false);
    } else if (res.state === "pending") {
      setIsFollowing(false);
      setIsPending(true);
    } else {
      setIsFollowing(false);
      setIsPending(false);
    }
  }

  if (loading) return <WorkspacePageSkeleton />;
  if (!project) return null;

  const showJoinRequests = canReview && (requestsLoading || joinRequests.length > 0);

  return (
    <>
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold tracking-wide text-zinc-500">
                {tx("参加申請", "Join requests")}
                {joinRequests.length > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4B4B] px-1.5 text-[11px] font-extrabold text-white">
                    {joinRequests.length}
                  </span>
                ) : null}
              </h2>
            </div>
            <ul>
              {requestsLoading ? (
                <li className="list-none py-2">
                  <StackSkeleton count={2} />
                </li>
              ) : null}
              {joinRequests.map((r) => {
                const profile = requesterProfiles[r.requester_id];
                const name = profile?.name ?? r.requester_id.slice(0, 8);
                return (
                  <li key={r.id} className="border-b border-zinc-100 py-3 last:border-b-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => void openProfile(r.requester_id, name, profile?.avatarUrl)}
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
                        className="flex-1 rounded-full bg-[#FF9600] py-2 text-[12px] font-semibold text-white disabled:opacity-60"
                      >
                        {tx("承認", "Accept")}
                      </button>
                      <button
                        type="button"
                        disabled={reviewBusyId === r.id}
                        onClick={() => void reviewJoinRequest(r.id, "reject")}
                        className="flex-1 rounded-full border border-zinc-200 bg-white py-2 text-[12px] font-semibold text-zinc-700 disabled:opacity-60"
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
          <h2 className="mb-1 text-[13px] font-bold tracking-wide text-zinc-500">
            {tx("メンバー", "Members")}
            <span className="ml-2 font-semibold text-zinc-400">{project.members.length}</span>
          </h2>
          <ul>
            {project.members.map((m) => {
              const isSelf = Boolean(uid && m.id === uid);
              const avatarUrl = resolveMemberAvatarUrl(m.id, m.avatarUrl);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100"
                    onClick={() => void openProfile(m.id, m.name, m.avatarUrl)}
                  >
                    <Avatar name={m.name} url={avatarUrl} />
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
              <li className="py-6 text-center text-sm text-zinc-500">
                {tx("メンバー情報を取得できませんでした。", "Couldn’t load members.")}
              </li>
            ) : null}
          </ul>
        </section>
      </WorkspaceSlideShell>

      {portalReady && preview
        ? createPortal(
            <ExploreFriendProfilePreview
              key={preview.id}
              member={preview}
              projects={peerProjects}
              projectsLoading={peerProjectsLoading}
              isFollowing={isFollowing}
              isPending={isPending}
              onClose={() => setPreview(null)}
              onToggleFollow={() => {
                void onToggleFollow();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
