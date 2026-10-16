"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Search } from "lucide-react";
import { SKILL_OPTIONS } from "@/lib/discover/skillRequests";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createProjectRecruitment } from "@/lib/projects/projectRecruitments";
import { searchProfilesForInvite, sendProjectInvite } from "@/lib/projects/projectInvites";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, isOwner, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [skillName, setSkillName] = useState<string>(SKILL_OPTIONS[0]);
  const [duration, setDuration] = useState("1週間");
  const [compensation, setCompensation] = useState("なし（経験・実績として）");
  const [postToBoard, setPostToBoard] = useState(true);

  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [inviteSearchBusy, setInviteSearchBusy] = useState(false);
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState("");
  const [canInvite, setCanInvite] = useState(false);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkInviteRole() {
      if (!supabase || !uid || !projectId) {
        if (!cancelled) setCanInvite(false);
        return;
      }
      if (isOwner) {
        if (!cancelled) setCanInvite(true);
        return;
      }
      const { data } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", uid)
        .maybeSingle();
      const role = (data as { role?: string } | null)?.role;
      if (!cancelled) setCanInvite(role === "owner" || role === "admin");
    }
    void checkInviteRole();
    return () => {
      cancelled = true;
    };
  }, [uid, projectId, isOwner, project?.members]);

  async function onCreate() {
    if (!supabase || !uid || !project || !canEdit) return;
    if (!title.trim()) {
      showNotice(tx("欲しい人材を入力してください", "Enter the talent you want"));
      return;
    }
    setSaving(true);
    try {
      await createProjectRecruitment(supabase, {
        projectId,
        userId: uid,
        projectName: project.name,
        title,
        message,
        skillName,
        duration,
        compensation,
        postToSkillBoard: postToBoard,
        makeProjectPublic: projectMeta?.visibility !== "public",
      });
      setTitle("");
      setMessage("");
      await reload();
      showNotice(tx("募集を公開しました", "Recruitment published"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("公開に失敗しました", "Failed to publish"));
    } finally {
      setSaving(false);
    }
  }

  async function searchPeople() {
    if (!uid) return;
    const q = inviteQuery.trim();
    if (q.length < 1) {
      setInviteCandidates([]);
      return;
    }
    setInviteSearchBusy(true);
    setInviteErr("");
    try {
      const memberIds = (project?.members ?? []).map((m) => m.id);
      const hits = await searchProfilesForInvite(q, [uid, ...memberIds]);
      setInviteCandidates(
        hits.map((p) => ({
          id: p.id,
          name: p.display_name?.trim() || tx("ユーザー", "User"),
        })),
      );
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : tx("検索に失敗しました", "Search failed"));
      setInviteCandidates([]);
    } finally {
      setInviteSearchBusy(false);
    }
  }

  async function inviteMember(inviteeId: string, inviteeName: string) {
    setInviteBusyId(inviteeId);
    setInviteErr("");
    try {
      const res = await sendProjectInvite(projectId, inviteeId);
      if (!res.ok) {
        const msg = res.error;
        if (msg.includes("すでにメンバー")) {
          setInviteErr(tx("すでにメンバーです。", "Already a member."));
        } else {
          setInviteErr(msg);
        }
        return;
      }
      setInviteCandidates((prev) => prev.filter((c) => c.id !== inviteeId));
      setInviteQuery("");
      await reload();
      showNotice(
        tx(`${inviteeName} さんを招待しました。相手のお知らせに届きます。`, `Invited ${inviteeName}. They’ll get a notification.`),
      );
    } finally {
      setInviteBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {notice ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
          {notice}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-zinc-500">
              {tx(`${project.name} の募集`, `Recruiting for ${project.name}`)}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-zinc-950 sm:text-lg">
              {tx("欲しい人材を募集", "Recruit talent")}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              {tx(
                "欲しい人材を公開して仲間を募るか、表示名で探して直接招待できます。",
                "Post an opening to recruit teammates, or search by display name and invite directly.",
              )}
            </p>
          </div>
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        </div>

        {!canEdit ? (
          <p className="mt-4 text-sm text-zinc-500">
            {tx("募集の編集はオーナー・管理者のみできます。", "Only owners and admins can manage recruitment.")}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder={tx("欲しい人材・姿勢（必須）", "Wanted talent / mindset (required)")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              rows={3}
              placeholder={tx("募集文・ビジョン（任意）", "Recruitment message / vision (optional)")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <label className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={postToBoard}
                onChange={(e) => setPostToBoard(e.target.checked)}
              />
              <span>
                {tx(
                  "スキル募集ボードにも出す（探す・Discover で見つけやすくなります）",
                  "Also post to the skills board (easier to find on Discover)",
                )}
              </span>
            </label>
            {postToBoard ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                >
                  {SKILL_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option>1日以内</option>
                  <option>1週間</option>
                  <option>1ヶ月</option>
                  <option>長期</option>
                </select>
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                >
                  <option>なし（経験・実績として）</option>
                  <option>成果報酬</option>
                  <option>相談</option>
                </select>
              </div>
            ) : null}
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {tx(
                "公開プロジェクトとして探すタブの「募集」に表示されます。非公開の場合は公開に切り替えます。",
                "Shown on Explore → Recruiting. Private projects are switched to public.",
              )}
            </p>
            <button
              type="button"
              disabled={saving || !title.trim()}
              className="w-full min-h-[44px] rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void onCreate()}
            >
              {saving ? tx("公開中…", "Publishing…") : tx("この内容で募集を追加する", "Add this recruitment")}
            </button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">
              {tx("人を探す", "Find people")}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              {tx(
                "表示名で検索して、このプロジェクトに招待できます。",
                "Search by display name and invite them to this project.",
              )}
            </p>
          </div>
          <Search className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
        </div>

        {!canInvite ? (
          <p className="mt-4 text-sm text-zinc-500">
            {tx("招待はオーナー・管理者のみできます。", "Only owners and admins can invite people.")}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {inviteErr ? (
              <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-800">
                {inviteErr}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                placeholder={tx("表示名で検索", "Search by display name")}
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchPeople();
                  }
                }}
              />
              <button
                type="button"
                disabled={inviteSearchBusy || !inviteQuery.trim()}
                onClick={() => void searchPeople()}
                className="min-h-[44px] shrink-0 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 disabled:opacity-50"
              >
                {inviteSearchBusy ? tx("検索中…", "Searching…") : tx("検索", "Search")}
              </button>
            </div>
            <ul className="space-y-2">
              {inviteCandidates.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2.5"
                >
                  <span className="truncate text-sm font-medium text-zinc-900">{c.name}</span>
                  <button
                    type="button"
                    disabled={inviteBusyId === c.id}
                    onClick={() => void inviteMember(c.id, c.name)}
                    className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {inviteBusyId === c.id ? tx("招待中…", "Inviting…") : tx("招待する", "Invite")}
                  </button>
                </li>
              ))}
              {inviteQuery.trim() && !inviteSearchBusy && inviteCandidates.length === 0 ? (
                <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-sm text-zinc-500">
                  {tx("該当するユーザーが見つかりません。", "No matching users.")}
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
