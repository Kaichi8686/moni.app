"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { RoadmapAddPhaseModal } from "@/components/projects/workspace/roadmap/RoadmapAddPhaseModal";
import { RoadmapPhaseDetailPanel } from "@/components/projects/workspace/roadmap/RoadmapPhaseDetailPanel";
import { RoadmapTodayTodo } from "@/components/projects/workspace/roadmap/RoadmapTodayTodo";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import {
  endOfTodayIso,
  mergeRoadmapPhasesWithIssues,
  type RoadmapPhaseWithIssues,
} from "@/lib/roadmap/mergeWithIssues";

export default function WorkspaceRoadmapView() {
  const {
    projectId,
    project: wsProject,
    issues,
    loading: wsLoading,
    canEdit,
    reload: wsReload,
    createIssue,
    updateIssueStatus,
    updateIssue,
  } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<RoadmapPhaseWithIssues | null>(null);
  const [actionError, setActionError] = useState("");

  const mergedPhases = useMemo(
    () => mergeRoadmapPhasesWithIssues(roadmap.phases, issues),
    [roadmap.phases, issues],
  );

  const selectedLive = selected ? mergedPhases.find((p) => p.id === selected.id) ?? null : null;

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
        setActionError(e instanceof Error ? e.message : "操作に失敗しました");
      }
    },
    [syncReload],
  );

  if (wsLoading || roadmap.loading) {
    return <p className="p-6 text-sm text-gray-500">読み込み中...</p>;
  }

  const err = roadmap.error || actionError;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1A1A1A]">ロードマップ</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            フェーズの期間とゴールをここで管理。具体的な作業は{" "}
            <Link href={`/projects/${projectId}/issues`} className="font-medium text-violet-600 hover:underline">
              課題タブ
            </Link>
            と連動します。
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-violet-700"
          >
            + フェーズを追加
          </button>
        ) : null}
      </div>

      {err ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</p>
      ) : null}

      <p className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-[12px] text-violet-900">
        タイムラインの<strong className="font-semibold">色付きバー</strong>または<strong className="font-semibold">左のフェーズ名</strong>
        をタップすると詳細が開きます。バー左端をドラッグすると期間を移動できます。
      </p>

      <RoadmapTodayTodo
        phases={mergedPhases}
        issues={issues}
        projectId={projectId}
        projectName={roadmap.project?.name ?? wsProject?.name}
        canEdit={canEdit}
      />

      {mergedPhases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafaf8] px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">まだフェーズがありません</p>
          <p className="mt-2 text-sm text-gray-500">ビジネスの種類に合わせたテンプレートから、すぐに始められます。</p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-4 rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
            >
              テンプレートを選ぶ
            </button>
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
        existingCount={mergedPhases.length}
        onBulkAddPhases={(items, t) => wrap(() => roadmap.bulkCreatePhases(items, t))}
        onAddSingle={(input) => wrap(() => roadmap.createPhase(input))}
      />

      {selectedLive ? (
        <RoadmapPhaseDetailPanel
          projectId={projectId}
          phase={selectedLive}
          projectName={roadmap.project?.name ?? wsProject?.name ?? ""}
          projectDescription={roadmap.project?.description ?? wsProject?.description}
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
        />
      ) : null}
    </div>
  );
}
