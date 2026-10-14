"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { SKILL_OPTIONS } from "@/lib/discover/skillRequests";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  closeProjectRecruitment,
  createProjectRecruitment,
  ensureLegacyRecruitmentMigrated,
  listProjectRecruitments,
  type ProjectRecruitment,
} from "@/lib/projects/projectRecruitments";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, isOwner, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");
  const [rows, setRows] = useState<ProjectRecruitment[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [skillName, setSkillName] = useState<string>(SKILL_OPTIONS[0]);
  const [duration, setDuration] = useState("1週間");
  const [compensation, setCompensation] = useState("なし（経験・実績として）");
  const [postToBoard, setPostToBoard] = useState(true);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4200);
  }, []);

  const loadList = useCallback(async () => {
    if (!supabase || !project) {
      setListLoading(false);
      return;
    }
    setListLoading(true);
    try {
      const ownerId =
        project.members.find((m) => m.role === "owner")?.id ?? (isOwner ? uid : null) ?? uid ?? "";
      if (ownerId) {
        await ensureLegacyRecruitmentMigrated(supabase, {
          projectId,
          ownerId,
          recruitmentTarget: projectMeta?.recruitment_target ?? "",
          recruitmentMessage: projectMeta?.recruitment_message ?? "",
        });
      }
      const list = await listProjectRecruitments(supabase, projectId);
      // このプロジェクトの募集だけ表示（他プロジェクト分が混ざらないようにする）
      setRows(list.filter((r) => r.projectId === projectId));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("募集の取得に失敗しました", "Failed to load recruitments"));
    } finally {
      setListLoading(false);
    }
  }, [project, projectId, projectMeta, uid, isOwner, showNotice, tx]);

  useEffect(() => {
    if (loading || !project) return;
    void loadList();
  }, [loading, project, loadList]);

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
      await loadList();
      await reload();
      showNotice(tx("募集を公開しました", "Recruitment published"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("公開に失敗しました", "Failed to publish"));
    } finally {
      setSaving(false);
    }
  }

  async function onClose(id: string) {
    if (!supabase || !canEdit) return;
    setClosingId(id);
    try {
      await closeProjectRecruitment(supabase, id, projectId);
      await loadList();
      await reload();
      showNotice(tx("募集を締め切りました", "Recruitment closed"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("締切に失敗しました", "Failed to close"));
    } finally {
      setClosingId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const openRows = rows.filter((r) => r.status === "open");
  const closedRows = rows.filter((r) => r.status === "closed");

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
                "このプロジェクトの募集だけを管理できます。いくつでも出せて、不要になったら締め切れます。",
                "Manage openings for this project only. Post as many as you need and close any time.",
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {tx(
              `このプロジェクトの公開中（${openRows.length}）`,
              `Open for this project (${openRows.length})`,
            )}
          </h3>
          {openRows.length > 0 ? (
            <Link
              href="/?tab=chat&segment=recruit"
              className="text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              {tx("探すタブで見る", "View on Explore")}
            </Link>
          ) : null}
        </div>
        {listLoading ? (
          <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
        ) : openRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            {tx(
              "このプロジェクトの公開中の募集はまだありません。",
              "No open recruitments for this project yet.",
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {openRows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{r.title}</p>
                    {r.message ? (
                      <p className="mt-1 line-clamp-2 text-[12px] text-zinc-600">{r.message}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {[r.skillName, r.duration, r.compensation].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={closingId === r.id}
                      className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 disabled:opacity-50"
                      onClick={() => void onClose(r.id)}
                    >
                      {closingId === r.id ? "…" : tx("締め切る", "Close")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closedRows.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-500">
            {tx(
              `このプロジェクトの締め切り済み（${closedRows.length}）`,
              `Closed for this project (${closedRows.length})`,
            )}
          </h3>
          <ul className="space-y-2">
            {closedRows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-600 line-through decoration-zinc-300">
                  {r.title}
                </p>
                {r.message ? (
                  <p className="mt-1 line-clamp-1 text-[12px] text-zinc-400">{r.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
