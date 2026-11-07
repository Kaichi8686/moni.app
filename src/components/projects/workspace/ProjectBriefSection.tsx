"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
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

function reduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
  );
}

function subscribeNoop() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * アイデアタブ「育てる」と同じうっすらベール切替（色は薄いオレンジ）。
 * in: 0 → 0.88 / out: 0.88 → 0（画面差し替えはベールの裏で行う）
 */
function SceneVeil({ phase }: { phase: "in" | "out" }) {
  return (
    <motion.div
      key={phase === "in" ? "brief-veil-in" : "brief-veil-out"}
      className="pointer-events-none fixed inset-0 z-[310] bg-[#FFF4E8]"
      initial={{ opacity: phase === "in" ? 0 : 0.88 }}
      animate={{ opacity: phase === "in" ? 0.88 : 0 }}
      transition={{
        duration: phase === "in" ? 0.34 : 0.4,
        ease: phase === "in" ? "easeInOut" : "easeOut",
      }}
      aria-hidden
    />
  );
}

export function ProjectBriefSection() {
  const { tx } = useI18n();
  const portalReady = useIsClient();
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
  /** 育てる押下時と同じうっすら画面切替 */
  const [sceneVeil, setSceneVeil] = useState<"idle" | "in" | "out">("idle");
  const veilTimersRef = useRef<number[]>([]);

  const clearVeilTimers = useCallback(() => {
    for (const id of veilTimersRef.current) window.clearTimeout(id);
    veilTimersRef.current = [];
  }, []);

  useEffect(() => () => clearVeilTimers(), [clearVeilTimers]);

  const isDirty =
    draft.problemMotivation.trim() !== brief.problemMotivation.trim() ||
    draft.projectGoal.trim() !== brief.projectGoal.trim() ||
    (!filled && Boolean(draft.problemMotivation.trim() || draft.projectGoal.trim()));

  const discardAndClose = useCallback(() => {
    clearVeilTimers();
    setSceneVeil("idle");
    setConfirmDiscard(false);
    setComposerOpen(false);
    setError("");
    setDraft(brief);
    if (project?.id) clearProjectBriefDraft(project.id);
  }, [brief, project?.id, clearVeilTimers]);

  const requestClose = useCallback(() => {
    if (saving || sceneVeil !== "idle") return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    discardAndClose();
  }, [saving, sceneVeil, isDirty, discardAndClose]);

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
      setSceneVeil("idle");
    } else {
      setDraft((prev) => {
        if (composerOpen) return prev;
        return saved;
      });
    }
    setError("");
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per project/data change; ignore composerOpen to avoid clobber
  }, [coachingContext, project?.description, canEdit, project?.id]);

  /** 育てるボタンと同じ: ベール in → 画面差し替え → ベール out */
  const runVeilOpen = useCallback(() => {
    if (composerOpen && sceneVeil === "idle") return;
    if (sceneVeil === "in") return;

    if (reduceMotion()) {
      clearVeilTimers();
      setSceneVeil("idle");
      setComposerOpen(true);
      return;
    }

    clearVeilTimers();
    setSceneVeil("in");
    const t1 = window.setTimeout(() => {
      setComposerOpen(true);
      setSceneVeil("out");
      const t2 = window.setTimeout(() => setSceneVeil("idle"), 420);
      veilTimersRef.current.push(t2);
    }, 340);
    veilTimersRef.current.push(t1);
  }, [composerOpen, sceneVeil, clearVeilTimers]);

  const prepareDraft = useCallback(() => {
    if (!project) return;
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
    writeProjectBriefDraft(project.id, {
      open: true,
      problemMotivation: stored && !filled ? stored.problemMotivation : brief.problemMotivation,
      projectGoal: stored && !filled ? stored.projectGoal : brief.projectGoal,
    });
  }, [project, filled, brief]);

  const openComposerWithVeil = useCallback(() => {
    if (!canEdit || saving || !project) return;
    prepareDraft();
    runVeilOpen();
  }, [canEdit, saving, project, prepareDraft, runVeilOpen]);

  useEffect(() => {
    if (!canEdit) return;
    const onEditRequest = () => {
      const next = resolveProjectBrief({
        coachingContext,
        description: project?.description,
      });
      setDraft(next);
      setConfirmDiscard(false);
      setError("");
      if (project?.id) {
        writeProjectBriefDraft(project.id, {
          open: true,
          problemMotivation: next.problemMotivation,
          projectGoal: next.projectGoal,
        });
      }
      runVeilOpen();
    };
    window.addEventListener("moni:edit-project-brief", onEditRequest);
    return () => window.removeEventListener("moni:edit-project-brief", onEditRequest);
  }, [canEdit, coachingContext, project?.description, project?.id, runVeilOpen]);

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
      clearVeilTimers();
      setSceneVeil("idle");
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
  if (filled && !composerOpen && sceneVeil === "idle") return null;

  return (
    <>
      {hydrated && !filled && canEdit && !composerOpen ? (
        <section id="project-brief" className="px-0">
          <ProjectGoalBanner
            projectName={project.name}
            goal=""
            emptyHint={tx("タップしてゴールを書く", "Tap to write your goal")}
            onClick={openComposerWithVeil}
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

      {portalReady && (sceneVeil === "in" || sceneVeil === "out")
        ? createPortal(<SceneVeil phase={sceneVeil} />, document.body)
        : null}
    </>
  );
}
