"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { ProjectCompletionDateCard } from "@/components/projects/workspace/ProjectCompletionDateCard";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { RoadmapAddPhaseModal } from "@/components/projects/workspace/roadmap/RoadmapAddPhaseModal";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { IssueModal } from "@/components/issues/IssueModal";
import { RoadmapPhaseDetailPanel } from "@/components/projects/workspace/roadmap/RoadmapPhaseDetailPanel";
import type { Issue } from "@/lib/workspace/types";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { buildIssueScheduleContext, syncRoadmapIssuesFromPhases } from "@/lib/templates/createRoadmapIssues";
import {
  endOfTodayIso,
  mergeRoadmapPhasesWithIssues,
  type RoadmapPhaseWithIssues,
} from "@/lib/roadmap/mergeWithIssues";

export default function WorkspaceRoadmapView() {
  const { tx } = useI18n();
  const {
    projectId,
    issues,
    phases,
    schedules,
    loading: wsLoading,
    canEdit,
    reload: wsReload,
    createIssue,
    updateIssueStatus,
    updateIssue,
    updateIssueWorkflow,
    completeIssue,
    project,
    projectContext,
    coachingContext,
    setProjectCompletionDate,
  } = useProjectWorkspace();
  const searchParams = useSearchParams();
  const roadmap = useRoadmapProject(projectId);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<RoadmapPhaseWithIssues | null>(null);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);
  const [actionError, setActionError] = useState("");
  const [scheduleNotice, setScheduleNotice] = useState("");

  const templatesHref = `/projects/${projectId}/roadmap/templates`;

  const mergedPhases = useMemo(
    () => mergeRoadmapPhasesWithIssues(roadmap.phases, issues),
    [roadmap.phases, issues],
  );

  const selectedLive = selected ? mergedPhases.find((p) => p.id === selected.id) ?? null : null;

  const phaseIdFromUrl = searchParams.get("phase");
  useEffect(() => {
    if (!phaseIdFromUrl || mergedPhases.length === 0) return;
    const phase = mergedPhases.find((p) => p.id === phaseIdFromUrl);
    if (phase) setSelected(phase);
  }, [phaseIdFromUrl, mergedPhases]);

  const detailIssueLive = detailIssue ? issues.find((i) => i.id === detailIssue.id) ?? detailIssue : null;
  const editIssueLive = editIssue ? issues.find((i) => i.id === editIssue.id) ?? editIssue : null;
  const detailPhase = detailIssueLive?.phaseId
    ? mergedPhases.find((p) => p.id === detailIssueLive.phaseId)
    : selectedLive;
  const detailPhaseTitle = detailPhase?.title;
  const detailPhaseGoal = detailPhase?.goal;

  const openIssueCount = useMemo(
    () => issues.filter((i) => i.status !== "done" && i.status !== "cancelled").length,
    [issues],
  );

  const taskCount = useMemo(
    () => mergedPhases.reduce((n, p) => n + p.tasks.length, 0),
    [mergedPhases],
  );
  const linkedIssueCount = useMemo(
    () => mergedPhases.reduce((n, p) => n + p.linkedIssues.length, 0),
    [mergedPhases],
  );
  const showSyncIssuesBanner = canEdit && taskCount > 0 && linkedIssueCount < taskCount;

  const syncReload = useCallback(async () => {
    await Promise.all([roadmap.reload(), wsReload()]);
  }, [roadmap, wsReload]);

  const wrap = useCallback(
    async (fn: () => Promise<void>) => {
      setActionError("");
      try {
        await fn();
        await syncReload();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : tx("操作に失敗しました", "Action failed"));
      }
    },
    [syncReload, tx],
  );

  if (wsLoading || roadmap.loading) {
    return <p className="p-6 text-sm text-gray-500">{tx("読み込み中...", "Loading…")}</p>;
  }

  const err = roadmap.error || actionError;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("ロードマップ", "Roadmap")}</h1>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">
            {tx("段階ごとの計画と、課題のつながりです。", "Phase-by-phase plan and how issues connect.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={templatesHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F7F8F8]"
          >
            <Layers className="h-4 w-4" />
            {tx("テンプレート", "Templates")}
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-md bg-[#5E6AD2] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#4F5BBD]"
            >
              {tx("+ フェーズを追加", "+ Add phase")}
            </button>
          ) : null}
        </div>
      </div>

      {project ? (
        <ProjectCompletionDateCard
          canEdit={canEdit}
          projectStart={project.startDate}
          projectTarget={project.targetDate}
          openIssueCount={openIssueCount}
          onSave={setProjectCompletionDate}
          onNotice={(message) => {
            setScheduleNotice(message);
            window.setTimeout(() => setScheduleNotice(""), 4000);
          }}
        />
      ) : null}
      {scheduleNotice ? (
        <p
          className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-center text-[12px] font-medium text-[#374151]"
          role="status"
        >
          {scheduleNotice}
        </p>
      ) : null}

      {err ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</p>
      ) : null}

      {showSyncIssuesBanner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-white px-3 py-2.5">
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">{tx("段階のやることを課題にできます", "Turn phase tasks into issues")}</p>
            <p className="text-[11px] text-[#6B7280]">
              {tx(
                `未連携のやること ${taskCount - linkedIssueCount}件を課題として追加します。`,
                `Add ${taskCount - linkedIssueCount} unlinked tasks as issues.`,
              )}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md bg-[#5E6AD2] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#4F5BBD]"
            onClick={() =>
              void wrap(async () => {
                const taskTitlesByPhase = new Map<string, string[]>();
                for (const p of mergedPhases) {
                  taskTitlesByPhase.set(
                    p.id,
                    p.tasks.map((t) => t.title).filter(Boolean),
                  );
                }
                const schedule =
                  project &&
                  buildIssueScheduleContext({
                    projectStart: project.startDate,
                    projectTarget: project.targetDate,
                    phases: mergedPhases.map((p) => ({
                      id: p.id,
                      order: p.order,
                      startDate: p.startDate,
                      endDate: p.endDate,
                    })),
                    schedules,
                  });
                if (!projectContext) {
                  throw new Error(tx("プロジェクト情報を読み込んでから再度お試しください。", "Load the project, then try again."));
                }
                await syncRoadmapIssuesFromPhases({
                  projectId,
                  projectContext,
                  phases: mergedPhases.map((p) => ({
                    id: p.id,
                    title: p.title,
                    goal: p.goal,
                    description: p.description,
                    order: p.order,
                    startDate: p.startDate,
                    endDate: p.endDate,
                  })),
                  taskTitlesByPhase,
                  existingIssues: issues,
                  schedule: schedule ?? undefined,
                });
              })
            }
          >
            {tx("課題を生成する", "Create issues")}
          </button>
        </div>
      ) : null}

      {mergedPhases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafaf8] px-6 py-12 text-center">
          <p className="text-5xl">📋</p>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">{tx("またはテンプレートから始める", "Or start from a template")}</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
            {tx("テンプレートを使えばすぐ始められます。自分で0から作ることもできます。", "Start from a template, or build from scratch.")}
          </p>
          {canEdit ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href={`${templatesHref}?tab=ai`}
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                {tx("AIでプランを作る", "Plan with AI")}
              </Link>
              <Link
                href={templatesHref}
                className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                {tx("テンプレートを選ぶ", "Choose a template")}
              </Link>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-xl border border-gray-200 bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                {tx("＋ 自分で作る", "+ Build your own")}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <RoadmapTimeline
          phases={mergedPhases}
          canEdit={canEdit}
          onMovePhase={(id, d) => void wrap(() => roadmap.movePhase(id, d))}
          onResizePhase={(id, d) => void wrap(() => roadmap.resizePhase(id, d))}
          onSelectPhase={(p) => setSelected(p)}
        />
      )}

      <RoadmapAddPhaseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectStart={roadmap.project?.startDate}
        onBulkAddPhases={(items) => wrap(() => roadmap.bulkCreatePhases(items))}
      />

      {selectedLive ? (
        <RoadmapPhaseDetailPanel
          projectId={projectId}
          phase={selectedLive}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => wrap(() => roadmap.updatePhase(selectedLive.id, patch))}
          onDelete={() => wrap(() => roadmap.deletePhase(selectedLive.id))}
          onToggleIssueDone={(id, status) => wrap(() => updateIssueStatus(id, status))}
          onSetIssueDueToday={(id, today) =>
            wrap(() => updateIssue(id, { dueDate: today ? endOfTodayIso() : null }))
          }
          onCreateIssue={(phaseId, title) =>
            wrap(() =>
              createIssue({
                title,
                status: "todo",
                priority: "medium",
                phaseId,
              }),
            )
          }
          onOpenIssue={(issue) => setDetailIssue(issue)}
          projectName={project?.name ?? ""}
          projectDescription={project?.description ?? ""}
          coachingContext={coachingContext}
        />
      ) : null}

      <IssueDetailSheet
        issue={detailIssueLive}
        open={Boolean(detailIssueLive)}
        phaseTitle={detailPhaseTitle}
        phaseGoal={detailPhaseGoal}
        members={project?.members ?? []}
        canEdit={canEdit}
        onClose={() => setDetailIssue(null)}
        onEdit={
          canEdit && detailIssueLive
            ? () => {
                setEditIssue(detailIssueLive);
                setDetailIssue(null);
              }
            : undefined
        }
        onToggleDone={async (issue) => {
          await updateIssueStatus(issue.id, issue.status === "done" ? "todo" : "done");
        }}
        onSaveWorkflow={async (id, workflow) => updateIssueWorkflow(id, workflow)}
        onMarkIssueDone={async (id, answer) => completeIssue(id, answer)}
        onSaveMemo={async (id, memo) => {
          const issue = issues.find((i) => i.id === id);
          if (!issue) return;
          const phase = issue.phaseId ? phases.find((p) => p.id === issue.phaseId) : undefined;
          const { defaultWorkflowIfMissing } = await import("@/lib/workspace/issueWorkflow");
          const base = defaultWorkflowIfMissing(issue, phase?.title, phase?.description);
          await updateIssueWorkflow(id, { ...base, completionAnswer: memo.trim() });
        }}
      />

      <IssueModal
        issue={editIssueLive}
        open={Boolean(editIssueLive)}
        onClose={() => setEditIssue(null)}
        members={project?.members ?? []}
        canEdit={canEdit}
        onSave={async (id, patch) => {
          await updateIssue(id, {
            title: patch.title,
            description: patch.description,
            priority: patch.priority,
            status: patch.status,
            assigneeId: patch.assigneeId,
            dueDate: patch.dueDate,
          });
        }}
      />
    </div>
  );
}
