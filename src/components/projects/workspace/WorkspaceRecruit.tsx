"use client";

import { useCallback, useState } from "react";
import { Megaphone } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createProjectRecruitment } from "@/lib/projects/projectRecruitments";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { supabase } from "@/lib/supabase";

type WorkFormat = "online" | "in_person" | "other";

function formatWeeklyHours(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/時間/.test(trimmed) || /週/.test(trimmed)) return trimmed;
  return `週${trimmed}時間`;
}

function workFormatLabel(format: WorkFormat, tx: (ja: string, en: string) => string): string {
  if (format === "online") return tx("オンライン", "Online");
  if (format === "in_person") return tx("対面", "In person");
  return tx("その他", "Other");
}

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [compensation, setCompensation] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [workFormat, setWorkFormat] = useState<WorkFormat>("online");
  const [postToBoard, setPostToBoard] = useState(true);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 4200);
  }, []);

  async function onCreate() {
    if (!supabase || !uid || !project || !canEdit) return;
    if (!title.trim()) {
      showNotice(tx("欲しい人材を入力してください", "Enter the talent you want"));
      return;
    }
    setSaving(true);
    try {
      const roleText = role.trim();
      const hoursText = formatWeeklyHours(weeklyHours);
      const formatText = workFormatLabel(workFormat, tx);
      const duration = [hoursText, formatText].filter(Boolean).join(" · ");
      await createProjectRecruitment(supabase, {
        projectId,
        userId: uid,
        projectName: project.name,
        title,
        message,
        skillName: roleText || title.trim(),
        duration: duration || undefined,
        compensation: compensation.trim() || undefined,
        postToSkillBoard: postToBoard,
        makeProjectPublic: projectMeta?.visibility !== "public",
      });
      setTitle("");
      setMessage("");
      setRole("");
      setCompensation("");
      setWeeklyHours("");
      setWorkFormat("online");
      await reload();
      showNotice(tx("募集を公開しました", "Recruitment published"));
    } catch (e) {
      showNotice(e instanceof Error ? e.message : tx("公開に失敗しました", "Failed to publish"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>
      </div>
    );
  }

  const formatOptions: Array<{ id: WorkFormat; label: string }> = [
    { id: "online", label: tx("オンライン", "Online") },
    { id: "in_person", label: tx("対面", "In person") },
    { id: "other", label: tx("その他", "Other") },
  ];

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-5 pb-10 sm:px-6 sm:py-6">
        {notice ? (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
            {notice}
          </p>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-zinc-500">
                {tx(`${project.name} の募集`, `Recruiting for ${project.name}`)}
              </p>
              <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
                {tx("欲しい人材を募集", "Recruit talent")}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                {tx(
                  "欲しい人材・役割・報酬・参加時間を書いて仲間を募れます。",
                  "Post the talent, role, pay, and weekly hours you need.",
                )}
              </p>
            </div>
            <Megaphone className="mt-1 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
          </div>

          {!canEdit ? (
            <p className="text-sm text-zinc-500">
              {tx("募集の編集はオーナー・管理者のみできます。", "Only owners and admins can manage recruitment.")}
            </p>
          ) : (
            <div className="space-y-3">
              <input
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                placeholder={tx("欲しい人材・姿勢（必須）", "Wanted talent / mindset (required)")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                rows={4}
                placeholder={tx("募集文・ビジョン（任意）", "Recruitment message / vision (optional)")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("役割", "Role")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder={tx("例: デザイナー、広報", "e.g. Designer, PR")}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("報酬", "Compensation")}
                  </span>
                  <input
                    className="min-h-[48px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder={tx("例: なし、成果報酬", "e.g. Unpaid, revenue share")}
                    value={compensation}
                    onChange={(e) => setCompensation(e.target.value)}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-semibold text-zinc-500">
                    {tx("週の参加時間", "Hours / week")}
                  </span>
                  <div className="flex min-h-[48px] items-center gap-2 rounded-xl border border-zinc-200 px-3 focus-within:border-zinc-400">
                    <span className="shrink-0 text-sm text-zinc-500">{tx("週", "Weekly")}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      placeholder={tx("例: 5", "e.g. 5")}
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(e.target.value)}
                    />
                    <span className="shrink-0 text-sm text-zinc-500">{tx("時間", "hrs")}</span>
                  </div>
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold text-zinc-500">{tx("形式", "Format")}</legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tx("形式", "Format")}>
                  {formatOptions.map((opt) => {
                    const active = workFormat === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`min-h-[44px] rounded-xl border text-sm font-semibold transition ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                        onClick={() => setWorkFormat(opt.id)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

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
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {tx(
                  "公開プロジェクトとして探すタブの「募集」に表示されます。非公開の場合は公開に切り替えます。",
                  "Shown on Explore → Recruiting. Private projects are switched to public.",
                )}
              </p>
              <button
                type="button"
                disabled={saving || !title.trim()}
                className="w-full min-h-[48px] rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void onCreate()}
              >
                {saving ? tx("公開中…", "Publishing…") : tx("この内容で募集を追加する", "Add this recruitment")}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
