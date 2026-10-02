"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { Avatar } from "@/components/ui/Avatar";
import { navigateToDirectMessage } from "@/lib/messages/openDirectMessage";
import { sendProjectInvite } from "@/lib/projects/projectInvites";
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

export default function WorkspaceMembers() {
  const { tx } = useI18n();
  const router = useRouter();
  const { project, projectId, loading, uid, reload } = useProjectWorkspace();
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [inviteSearchBusy, setInviteSearchBusy] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
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

  /** オーナー／管理者だけ申請承認・招待できる（RPC と一致） */
  const canInviteOrReview = isModerator;

  const loadJoinRequests = useCallback(async () => {
    if (!supabase || !canInviteOrReview) {
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
      const ids = [...new Set(rows.map((r) => r.requester_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
        const map: Record<string, string> = {};
        for (const p of profs ?? []) {
          map[p.id as string] = ((p.display_name as string | null)?.trim() || "ユーザー") as string;
        }
        setRequesterNames(map);
      } else {
        setRequesterNames({});
      }
    } finally {
      setRequestsLoading(false);
    }
  }, [canInviteOrReview, projectId]);

  useEffect(() => {
    if (!moderatorRolesLoaded) return;
    void loadJoinRequests();
  }, [loadJoinRequests, moderatorRolesLoaded]);

  async function searchInviteCandidates() {
    if (!supabase || !uid) return;
    const q = inviteQuery.trim();
    if (q.length < 1) {
      setInviteCandidates([]);
      return;
    }
    setInviteSearchBusy(true);
    setActionErr("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name")
        .ilike("display_name", `%${q}%`)
        .neq("id", uid)
        .limit(8);
      if (error) {
        setActionErr(error.message);
        setInviteCandidates([]);
        return;
      }
      const memberSet = new Set((project?.members ?? []).map((m) => m.id));
      setInviteCandidates(
        (data ?? [])
          .map((row) => ({
            id: row.id as string,
            name: ((row.display_name as string | null)?.trim() || "ユーザー") as string,
          }))
          .filter((row) => !memberSet.has(row.id)),
      );
    } finally {
      setInviteSearchBusy(false);
    }
  }

  async function inviteMember(inviteeId: string, inviteeName: string) {
    setInviteBusyId(inviteeId);
    setActionErr("");
    setActionOk("");
    try {
      const res = await sendProjectInvite(projectId, inviteeId);
      if (!res.ok) {
        const msg = res.error;
        if (msg.includes("すでにメンバー")) setActionErr(tx("すでにメンバーです。", "Already a member."));
        else setActionErr(msg);
        return;
      }
      setActionOk(
        tx(`${inviteeName} さんを招待しました。相手のお知らせに届きます。`, `Invited ${inviteeName}. They’ll get a notification.`),
      );
      setInviteCandidates((prev) => prev.filter((c) => c.id !== inviteeId));
      setInviteQuery("");
      await reload();
    } finally {
      setInviteBusyId(null);
    }
  }

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
      await loadJoinRequests();
      await reload();
    } finally {
      setReviewBusyId(null);
    }
  }

  async function openTalk(peerId: string) {
    if (!uid) {
      router.push("/login");
      return;
    }
    if (peerId === uid || !supabase) return;
    await navigateToDirectMessage(supabase, router, peerId);
  }

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return null;

  return (
    <div className="space-y-4">
      {actionErr ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{actionErr}</p>
      ) : null}
      {actionOk ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{actionOk}</p>
      ) : null}

      <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5E7EB] bg-[#F7F8F8] text-[11px] font-semibold text-[#6B7280]">
            <tr>
              <th className="px-4 py-2">{tx("メンバー", "Member")}</th>
              <th className="px-4 py-2">{tx("権限", "Role")}</th>
              <th className="w-24 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {project.members.map((m) => {
              const isSelf = Boolean(uid && m.id === uid);
              return (
                <tr key={m.id} className="border-b border-[#F7F8F8]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} url={m.avatarUrl} />
                      <span className="font-medium text-[#1A1A1A]">
                        {m.name}
                        {isSelf ? (
                          <span className="ml-1 text-[11px] font-normal text-[#6B7280]">{tx("（あなた）", "(you)")}</span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-[#6B7280]">{roleLabel(m.role, tx)}</td>
                  <td className="px-4 py-2 text-right">
                    {isSelf ? (
                      <span className="text-[11px] text-[#9CA3AF]">—</span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:bg-[#F7F8F8]"
                        onClick={() => void openTalk(m.id)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-[var(--brand,#ff5c35)]" aria-hidden />
                        {tx("トーク", "Chat")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {project.members.length === 0 ? (
          <p className="p-4 text-sm text-[#6B7280]">{tx("メンバー情報を取得できませんでした。", "Couldn’t load members.")}</p>
        ) : null}
      </div>

      {canInviteOrReview ? (
        <div className="rounded-md border border-[#E5E7EB] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">{tx("メンバーを招待", "Invite members")}</h3>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            {tx("表示名で検索して招待すると、相手のお知らせに届きます。", "Search by display name to invite — they’ll get a notification.")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              className="min-w-0 flex-1 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#9CA3AF]"
              placeholder={tx("表示名で検索", "Search by display name")}
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchInviteCandidates();
                }
              }}
            />
            <button
              type="button"
              disabled={inviteSearchBusy || !inviteQuery.trim()}
              onClick={() => void searchInviteCandidates()}
              className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
            >
              {inviteSearchBusy ? tx("検索中…", "Searching…") : tx("検索", "Search")}
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {inviteCandidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-[#E5E7EB] px-3 py-2">
                <span className="truncate text-sm font-medium text-[#1A1A1A]">{c.name}</span>
                <button
                  type="button"
                  disabled={inviteBusyId === c.id}
                  onClick={() => void inviteMember(c.id, c.name)}
                  className="shrink-0 rounded-md bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {inviteBusyId === c.id ? tx("招待中…", "Inviting…") : tx("招待する", "Invite")}
                </button>
              </li>
            ))}
            {inviteQuery.trim() && !inviteSearchBusy && inviteCandidates.length === 0 ? (
              <li className="text-sm text-[#6B7280]">{tx("該当するユーザーが見つかりません。", "No matching users.")}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {canInviteOrReview ? (
        <div className="rounded-md border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">{tx("参加申請", "Join requests")}</h3>
            <button
              type="button"
              className="rounded-md border border-[#E5E7EB] px-2 py-1 text-[11px] font-semibold text-[#6B7280]"
              onClick={() => void loadJoinRequests()}
            >
              {tx("再読み込み", "Reload")}
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {requestsLoading ? <li className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</li> : null}
            {joinRequests.map((r) => (
              <li key={r.id} className="rounded-md border border-[#E5E7EB] px-3 py-2">
                <p className="text-[12px] text-[#6B7280]">{requesterNames[r.requester_id] ?? r.requester_id.slice(0, 8)}</p>
                <p className="text-sm text-[#1A1A1A]">{r.message || tx("参加したいです", "I’d like to join")}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={reviewBusyId === r.id}
                    onClick={() => void reviewJoinRequest(r.id, "accept")}
                    className="rounded-md bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {tx("承認", "Accept")}
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusyId === r.id}
                    onClick={() => void reviewJoinRequest(r.id, "reject")}
                    className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] disabled:opacity-60"
                  >
                    {tx("拒否", "Reject")}
                  </button>
                </div>
              </li>
            ))}
            {!requestsLoading && joinRequests.length === 0 ? (
              <li className="text-sm text-[#6B7280]">{tx("承認待ちはありません。", "No pending requests.")}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
