"use client";

import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { parseCoachingContext } from "@/lib/projects/coachingContext";
import {
  applyBriefToCoachingContext,
  composeProjectDescription,
  emptyProjectBrief,
  resolveProjectBrief,
  trimProjectBrief,
  type ProjectBrief,
} from "@/lib/projects/projectBrief";
import { supabase } from "@/lib/supabase";

function hasCoreBrief(brief: ProjectBrief): boolean {
  const t = trimProjectBrief(brief);
  return Boolean(t.problemMotivation && t.projectGoal);
}

export function ProjectBriefSection() {
  const { tx } = useI18n();
  const { project, coachingContext, canEdit, reload } = useProjectWorkspace();
  const brief = resolveProjectBrief({
    coachingContext,
    description: project?.description,
  });
  const filled = hasCoreBrief(brief);

  const [editing, setEditing] = useState(!filled && canEdit);
  const [draft, setDraft] = useState<ProjectBrief>(brief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const next = resolveProjectBrief({
      coachingContext,
      description: project?.description,
    });
    setDraft(next);
    // 未入力なら概要で最初に打たせる。入力済みの閲覧モードは save 側で戻す。
    setEditing(!hasCoreBrief(next) && canEdit);
    setError("");
  }, [coachingContext, project?.description, canEdit, project?.id]);

  useEffect(() => {
    if (!canEdit) return;
    const onEditRequest = () => {
      const next = resolveProjectBrief({
        coachingContext,
        description: project?.description,
      });
      setDraft(next);
      setEditing(true);
      setError("");
      window.requestAnimationFrame(() => {
        document.getElementById("project-brief")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    };
    window.addEventListener("moni:edit-project-brief", onEditRequest);
    return () => window.removeEventListener("moni:edit-project-brief", onEditRequest);
  }, [canEdit, coachingContext, project?.description]);

  if (!project) return null;
  if (!filled && !canEdit) return null;

  async function save() {
    if (!canEdit || !supabase || !project) return;
    const nextBrief: ProjectBrief = {
      ...emptyProjectBrief(),
      whatToDo: brief.whatToDo,
      problemMotivation: draft.problemMotivation,
      projectGoal: draft.projectGoal,
    };
    const trimmed = trimProjectBrief(nextBrief);
    if (!trimmed.problemMotivation || !trimmed.projectGoal) {
      setError(
        tx(
          "きっかけとゴールの両方を入力してください。",
          "Please fill in both the motivation and the goal.",
        ),
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const descriptionText = composeProjectDescription(trimmed);
      const nextCoaching = applyBriefToCoachingContext(parseCoachingContext(coachingContext), trimmed);
      const payload: Record<string, unknown> = {
        description: descriptionText,
        coaching_context: nextCoaching,
        updated_at: new Date().toISOString(),
      };
      let { error: updateError } = await supabase.from("projects").update(payload).eq("id", project.id);
      if (updateError) {
        const schemaMismatch =
          updateError.code === "42703" ||
          updateError.code === "PGRST204" ||
          updateError.message.includes("does not exist") ||
          updateError.message.includes("schema cache");
        if (schemaMismatch) {
          const { coaching_context: _drop, ...withoutCoaching } = payload;
          void _drop;
          const retry = await supabase.from("projects").update(withoutCoaching).eq("id", project.id);
          updateError = retry.error;
        }
      }
      if (updateError) throw new Error(updateError.message);
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存に失敗しました", "Couldn’t save"));
    } finally {
      setSaving(false);
    }
  }

  if (editing && canEdit) {
    const isFirstFill = !filled;
    return (
      <section
        id="project-brief"
        className="rounded-2xl border border-orange-200/80 bg-orange-50/40 px-4 py-4 sm:px-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">
              {tx("プロジェクトのゴール", "Project goal")}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
              {isFirstFill
                ? tx(
                    "まず、なぜ始めたかとゴールを書いておきましょう。ロードマップの土台になります。",
                    "Start by writing why you began and the goal. It becomes the base for your roadmap.",
                  )
                : tx("きっかけとゴールを編集できます。", "You can edit the motivation and goal.")}
            </p>
          </div>
          {filled ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(brief);
                setEditing(false);
                setError("");
              }}
              className="shrink-0 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
              {tx("キャンセル", "Cancel")}
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[12px] font-semibold text-zinc-700">
              {tx(
                "どのようなことを解決したくてこのプロジェクトを思いついたか",
                "What problem made you think of this project?",
              )}
            </span>
            <textarea
              className="mt-1.5 min-h-[5rem] w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              rows={3}
              placeholder={tx(
                "例: 学校の行事告知がバラバラで、みんな見逃しがちだった",
                "e.g. Event notices were scattered and people kept missing them",
              )}
              value={draft.problemMotivation}
              onChange={(e) => setDraft((b) => ({ ...b, problemMotivation: e.target.value }))}
              disabled={saving}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-zinc-700">
              {tx("このプロジェクトのゴール", "Project goal")}
            </span>
            <textarea
              className="mt-1.5 min-h-[4rem] w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              rows={2}
              placeholder={tx(
                "例: 文化祭までに、クラス全員が見られる告知アプリを公開する",
                "e.g. Ship a notice app the whole class can use by the school festival",
              )}
              value={draft.projectGoal}
              onChange={(e) => setDraft((b) => ({ ...b, projectGoal: e.target.value }))}
              disabled={saving}
            />
          </label>
        </div>

        {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? tx("保存中…", "Saving…") : tx("保存する", "Save")}
        </button>
      </section>
    );
  }

  return (
    <section
      id="project-brief"
      className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">
          {tx("きっかけ", "Motivation")}
        </h2>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setDraft(brief);
              setEditing(true);
              setError("");
            }}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {tx("編集", "Edit")}
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold text-zinc-500">
          {tx(
            "どのようなことを解決したくてこのプロジェクトを思いついたか",
            "What problem made you think of this project?",
          )}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
          {brief.problemMotivation || "—"}
        </p>
      </div>
    </section>
  );
}
