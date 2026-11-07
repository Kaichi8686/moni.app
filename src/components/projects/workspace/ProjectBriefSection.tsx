"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectBriefComposer } from "@/components/projects/workspace/ProjectBriefComposer";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { persistProjectMotivationAndGoal } from "@/lib/projects/persistProjectBrief";
import {
  clearProjectBriefDraft,
  readProjectBriefDraft,
  writeProjectBriefDraft,
} from "@/lib/projects/projectBriefDraft";
import {
  emptyProjectBrief,
  resolveProjectBrief,
  trimProjectBrief,
  type ProjectBrief,
} from "@/lib/projects/projectBrief";

function hasCoreBrief(brief: ProjectBrief): boolean {
  const t = trimProjectBrief(brief);
  return Boolean(t.problemMotivation && t.projectGoal);
}

export function ProjectBriefSection() {
  const { tx } = useI18n();
  const { project, coachingContext, canEdit, reload, registerBackHandler } = useProjectWorkspace();
  const brief = resolveProjectBrief({
    coachingContext,
    description: project?.description,
  });
  const filled = hasCoreBrief(brief);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectBrief>(brief);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const isDirty =
    draft.problemMotivation.trim() !== brief.problemMotivation.trim() ||
    draft.projectGoal.trim() !== brief.projectGoal.trim() ||
    (!filled && Boolean(draft.problemMotivation.trim() || draft.projectGoal.trim()));

  const discardAndClose = useCallback(() => {
    setConfirmDiscard(false);
    setComposerOpen(false);
    setError("");
    setDraft(brief);
    if (project?.id) clearProjectBriefDraft(project.id);
  }, [brief, project?.id]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    discardAndClose();
  }, [saving, isDirty, discardAndClose]);

  // 保存済みデータの同期（入力中ドラフトは localStorage 側を優先）
  useEffect(() => {
    if (!project?.id) return;
    const saved = resolveProjectBrief({
      coachingContext,
      description: project.description,
    });
    const stored = readProjectBriefDraft(project.id);
    if (stored?.open && canEdit && !hasCoreBrief(saved)) {
      setDraft({
        ...emptyProjectBrief(),
        whatToDo: saved.whatToDo,
        problemMotivation: stored.problemMotivation,
        projectGoal: stored.projectGoal,
      });
      setComposerOpen(true);
    } else {
      setDraft((prev) => {
        // 作曲中はサーバ同期で上書きしない
        if (composerOpen) return prev;
        return saved;
      });
    }
    setError("");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per project/data change; ignore composerOpen to avoid clobber
  }, [coachingContext, project?.description, canEdit, project?.id]);

  useEffect(() => {
    if (!canEdit) return;
    const onEditRequest = () => {
      const next = resolveProjectBrief({
        coachingContext,
        description: project?.description,
      });
      setDraft(next);
      setComposerOpen(true);
      setConfirmDiscard(false);
      setError("");
      if (project?.id) {
        writeProjectBriefDraft(project.id, {
          open: true,
          problemMotivation: next.problemMotivation,
          projectGoal: next.projectGoal,
        });
      }
    };
    window.addEventListener("moni:edit-project-brief", onEditRequest);
    return () => window.removeEventListener("moni:edit-project-brief", onEditRequest);
  }, [canEdit, coachingContext, project?.description, project?.id]);

  // ドラフト永続化（他サイト・他タブへ行っても残す）
  useEffect(() => {
    if (!project?.id || !hydrated || !canEdit) return;
    if (!composerOpen) return;
    writeProjectBriefDraft(project.id, {
      open: true,
      problemMotivation: draft.problemMotivation,
      projectGoal: draft.projectGoal,
    });
  }, [
    composerOpen,
    draft.problemMotivation,
    draft.projectGoal,
    project?.id,
    hydrated,
    canEdit,
  ]);

  useEffect(() => {
    if (!composerOpen) {
      registerBackHandler(null);
      return;
    }
    registerBackHandler(() => {
      if (confirmDiscard) {
        setConfirmDiscard(false);
        return true;
      }
      requestClose();
      return true;
    });
    return () => registerBackHandler(null);
  }, [composerOpen, confirmDiscard, registerBackHandler, requestClose]);

  function openComposer() {
    if (!canEdit || saving || !project) return;
    const stored = readProjectBriefDraft(project.id);
    if (stored && !filled) {
      setDraft({
        ...emptyProjectBrief(),
        whatToDo: brief.whatToDo,
        problemMotivation: stored.problemMotivation,
        projectGoal: stored.projectGoal,
      });
    } else {
      setDraft(brief);
    }
    setError("");
    setConfirmDiscard(false);
    setComposerOpen(true);
    writeProjectBriefDraft(project.id, {
      open: true,
      problemMotivation: stored && !filled ? stored.problemMotivation : brief.problemMotivation,
      projectGoal: stored && !filled ? stored.projectGoal : brief.projectGoal,
    });
  }

  async function save() {
    if (!canEdit || !project) return;
    const trimmedMotivation = draft.problemMotivation.trim();
    const trimmedGoal = draft.projectGoal.trim();
    if (!trimmedMotivation || !trimmedGoal) {
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
      await persistProjectMotivationAndGoal({
        projectId: project.id,
        coachingContext,
        description: project.description,
        problemMotivation: trimmedMotivation,
        projectGoal: trimmedGoal,
      });
      clearProjectBriefDraft(project.id);
      setComposerOpen(false);
      setConfirmDiscard(false);
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message === "BRIEF_INCOMPLETE") {
        setError(
          tx(
            "きっかけとゴールの両方を入力してください。",
            "Please fill in both the motivation and the goal.",
          ),
        );
      } else {
        setError(e instanceof Error ? e.message : tx("保存に失敗しました", "Couldn’t save"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!project) return null;
  if (!filled && !canEdit) return null;
  if (filled && !composerOpen) return null;

  return (
    <>
      {hydrated && !filled && canEdit && !composerOpen ? (
        <section id="project-brief" className="px-0">
          <ProjectGoalBanner
            projectName={project.name}
            goal=""
            emptyHint={tx("タップしてゴールを書く", "Tap to write your goal")}
            onClick={openComposer}
          />
        </section>
      ) : null}

      {composerOpen && canEdit ? (
        <ProjectBriefComposer
          projectName={project.name}
          problemMotivation={draft.problemMotivation}
          projectGoal={draft.projectGoal}
          saving={saving}
          error={error}
          confirmDiscard={confirmDiscard}
          onChange={(next) =>
            setDraft((prev) => ({
              ...prev,
              problemMotivation: next.problemMotivation,
              projectGoal: next.projectGoal,
            }))
          }
          onBack={requestClose}
          onConfirmDiscard={discardAndClose}
          onCancelDiscard={() => setConfirmDiscard(false)}
          onSubmit={() => void save()}
        />
      ) : null}
    </>
  );
}
