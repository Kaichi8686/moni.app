"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { RoadmapStatusBadge } from "@/components/projects/workspace/roadmap/RoadmapStatusBadge";
import { RoadmapIssueList } from "@/components/projects/workspace/roadmap/RoadmapIssueList";
import type { RoadmapPhaseWithIssues } from "@/lib/roadmap/mergeWithIssues";
import type { PhaseStatus } from "@/lib/roadmap/types";
import type { IssueStatus } from "@/lib/workspace/types";

type Props = {
  projectId: string;
  phase: RoadmapPhaseWithIssues;
  projectName: string;
  projectDescription?: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdate: (patch: Partial<{ title: string; goal: string; status: PhaseStatus; startDate: string; endDate: string }>) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleIssueDone: (issueId: string, status: IssueStatus) => Promise<void>;
  onSetIssueDueToday: (issueId: string, today: boolean) => Promise<void>;
  onCreateIssue: (phaseId: string, title: string) => Promise<void>;
};

const STATUS_OPTIONS: PhaseStatus[] = ["planned", "in_progress", "paused", "completed"];

export function RoadmapPhaseDetailPanel({
  projectId,
  phase,
  projectName,
  projectDescription,
  canEdit,
  onClose,
  onUpdate,
  onDelete,
  onToggleIssueDone,
  onSetIssueDueToday,
  onCreateIssue,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [goalLoading, setGoalLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState(phase.title);
  const [goalDraft, setGoalDraft] = useState(phase.goal ?? "");

  useEffect(() => {
    setTitleDraft(phase.title);
    setGoalDraft(phase.goal ?? "");
  }, [phase.id, phase.title, phase.goal]);

  async function generateGoal() {
    setGoalLoading(true);
    try {
      const res = await fetch("/api/projects/coach/phase-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseTitle: phase.title,
          projectName,
          projectDescription: projectDescription ?? "",
        }),
      });
      const data = (await res.json()) as { goal?: string };
      if (data.goal) {
        setGoalDraft(data.goal);
        await onUpdate({ goal: data.goal });
      }
    } finally {
      setGoalLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`「${phase.title}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/20 lg:bg-black/10" aria-label="閉じる" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <RoadmapStatusBadge status={phase.status} />
          <div className="flex items-center gap-1">
            {canEdit ? (
              <div className="relative">
                <button
                  type="button"
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="メニュー"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => void handleDelete()}
                    >
                      フェーズを削除
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button type="button" className="rounded-md p-2 text-gray-500 hover:bg-gray-100" onClick={onClose} aria-label="閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {canEdit ? (
          <select
            value={phase.status}
            onChange={(e) => void onUpdate({ status: e.target.value as PhaseStatus })}
            className="mx-4 mt-3 w-auto rounded-lg border border-gray-200 px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "planned" ? "予定" : s === "in_progress" ? "進行中" : s === "paused" ? "一時停止" : "完了"}
              </option>
            ))}
          </select>
        ) : null}

        <input
          readOnly={!canEdit}
          className="w-full border-none p-4 text-xl font-semibold outline-none"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            if (canEdit && titleDraft.trim() !== phase.title) void onUpdate({ title: titleDraft });
          }}
        />

        <div className="px-4 pb-3">
          <label className="mb-1 block text-xs text-gray-500">このフェーズのゴール</label>
          <div className="flex gap-2">
            <input
              readOnly={!canEdit}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
              placeholder="例：ターゲットと直接10人話す"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={() => {
                if (canEdit && goalDraft !== (phase.goal ?? "")) void onUpdate({ goal: goalDraft });
              }}
            />
            {canEdit ? (
              <button
                type="button"
                disabled={goalLoading}
                onClick={() => void generateGoal()}
                className="whitespace-nowrap rounded-lg border border-violet-300 px-3 text-xs text-violet-600 hover:bg-violet-50"
              >
                {goalLoading ? "生成中" : "AI生成"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 px-4 pb-4">
          <div>
            <label className="text-xs text-gray-500">開始日</label>
            <input
              type="date"
              readOnly={!canEdit}
              className="mt-1 block rounded-lg border border-gray-200 px-2 py-1 text-sm"
              value={phase.startDate.slice(0, 10)}
              onChange={(e) => void onUpdate({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">終了日</label>
            <input
              type="date"
              readOnly={!canEdit}
              className="mt-1 block rounded-lg border border-gray-200 px-2 py-1 text-sm"
              value={phase.endDate.slice(0, 10)}
              onChange={(e) => void onUpdate({ endDate: e.target.value })}
            />
          </div>
        </div>

        <RoadmapIssueList
          projectId={projectId}
          phaseId={phase.id}
          issues={phase.linkedIssues}
          canEdit={canEdit}
          onToggleDone={(id, status) => void onToggleIssueDone(id, status)}
          onSetDueToday={(id, today) => void onSetIssueDueToday(id, today)}
          onCreate={onCreateIssue}
        />
      </aside>
    </>
  );
}
