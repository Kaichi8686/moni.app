"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { RoadmapAddPhaseModal } from "@/components/projects/workspace/roadmap/RoadmapAddPhaseModal";
import { RoadmapPhaseDetailPanel } from "@/components/projects/workspace/roadmap/RoadmapPhaseDetailPanel";
import { RoadmapTodayTodo } from "@/components/projects/workspace/roadmap/RoadmapTodayTodo";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import type { RoadmapPhase } from "@/lib/roadmap/types";

export default function WorkspaceRoadmapView() {
  const { projectId, project: wsProject, loading: wsLoading } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<RoadmapPhase | null>(null);
  const [actionError, setActionError] = useState("");

  const selectedLive = selected ? roadmap.phases.find((p) => p.id === selected.id) ?? null : null;

  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作に失敗しました");
    }
  }, []);

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
            フェーズの流れと「今日やること」をここで管理します。課題の一覧は{" "}
            <Link href={`/projects/${projectId}/issues`} className="font-medium text-violet-600 hover:underline">
              課題タブ
            </Link>
            から。
          </p>
        </div>
        {roadmap.canEdit ? (
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

      <RoadmapTodayTodo phases={roadmap.phases} canEdit={roadmap.canEdit} />

      {roadmap.phases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafaf8] px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-800">まだフェーズがありません</p>
          <p className="mt-2 text-sm text-gray-500">ビジネスの種類に合わせたテンプレートから、すぐに始められます。</p>
          {roadmap.canEdit ? (
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
          phases={roadmap.phases}
          onMovePhase={(id, d) => void wrap(() => roadmap.movePhase(id, d))}
          onResizePhase={(id, d) => void wrap(() => roadmap.resizePhase(id, d))}
          onSelectPhase={(p) => setSelected(p)}
        />
      )}

      <RoadmapAddPhaseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectStart={roadmap.project?.startDate}
        existingCount={roadmap.phases.length}
        onBulkAdd={(t) => wrap(() => roadmap.bulkCreateFromTemplate(t))}
        onAddSingle={(input) => wrap(() => roadmap.createPhase(input))}
      />

      {selectedLive ? (
        <RoadmapPhaseDetailPanel
          phase={selectedLive}
          projectName={roadmap.project?.name ?? wsProject?.name ?? ""}
          projectDescription={roadmap.project?.description ?? wsProject?.description}
          canEdit={roadmap.canEdit}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => wrap(() => roadmap.updatePhase(selectedLive.id, patch))}
          onDelete={() => wrap(() => roadmap.deletePhase(selectedLive.id))}
          onToggleTaskDone={(id, status) => wrap(() => roadmap.updateTask(id, { status }))}
          onToggleTaskToday={(id, next) => wrap(() => roadmap.toggleTaskToday(id, next))}
          onCreateTask={(phaseId, title) => wrap(() => roadmap.createTask(phaseId, title))}
        />
      ) : null}
    </div>
  );
}
