"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { RoadmapStatusBadge } from "@/components/projects/workspace/roadmap/RoadmapStatusBadge";
import { RoadmapIssueList } from "@/components/projects/workspace/roadmap/RoadmapIssueList";
import type { RoadmapPhaseWithIssues } from "@/lib/roadmap/mergeWithIssues";
import type { PhaseStatus } from "@/lib/roadmap/types";
import type { Issue, IssueStatus } from "@/lib/workspace/types";
import { resolveUserSituation, type CoachingContext } from "@/lib/projects/coachingContext";

type Props = {
  projectId: string;
  phase: RoadmapPhaseWithIssues;
  canEdit: boolean;
  onClose: () => void;
  onUpdate: (
    patch: Partial<{ title: string; goal: string; description: string; status: PhaseStatus; startDate: string; endDate: string }>,
  ) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleIssueDone: (issueId: string, status: IssueStatus) => Promise<void>;
  onSetIssueDueToday: (issueId: string, today: boolean) => Promise<void>;
  onCreateIssue: (phaseId: string, title: string) => Promise<void>;
  onOpenIssue?: (issue: Issue) => void;
  projectName?: string;
  projectDescription?: string;
  coachingContext?: CoachingContext;
};

const STATUS_OPTIONS: PhaseStatus[] = ["planned", "in_progress", "paused", "completed"];

export function RoadmapPhaseDetailPanel({
  projectId,
  phase,
  canEdit,
  onClose,
  onUpdate,
  onDelete,
  onToggleIssueDone,
  onSetIssueDueToday,
  onCreateIssue,
  onOpenIssue,
  projectName = "",
  projectDescription = "",
  coachingContext = {},
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [goalAiBusy, setGoalAiBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState(phase.title);
  const [goalDraft, setGoalDraft] = useState(phase.goal ?? "");

  useEffect(() => {
    setTitleDraft(phase.title);
    setGoalDraft(phase.goal ?? "");
    setDeleteConfirm(false);
    setMenuOpen(false);
  }, [phase.id, phase.title, phase.goal]);

  async function handleDelete() {
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 top-28 z-40 bg-black/20 lg:top-24 lg:bg-black/10"
        aria-label="閉じる"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <aside className="fixed bottom-0 right-0 top-28 z-[90] flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl lg:top-24">
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
                  <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
                    {deleteConfirm ? (
                      <div className="px-3 py-2">
                        <p className="text-[12px] font-medium text-red-800">「{phase.title}」を削除しますか？</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteConfirm(false)}
                            className="min-h-[36px] flex-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleDelete()}
                            className="min-h-[36px] flex-1 rounded-md bg-red-600 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busy ? "削除中…" : "削除"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        フェーズを削除
                      </button>
                    )}
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
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs text-gray-500">このフェーズのゴール</label>
            {canEdit ? (
              <button
                type="button"
                disabled={goalAiBusy}
                onClick={() => {
                  setGoalAiBusy(true);
                  void fetch("/api/projects/coach/phase-goal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      phaseTitle: phase.title,
                      projectName,
                      projectDescription,
                      dreamStatement: coachingContext.dreamStatement ?? "",
                      userSituation: resolveUserSituation(coachingContext),
                    }),
                  })
                    .then(async (r) => {
                      const j = (await r.json()) as {
                        goal?: string;
                        action?: string;
                        why?: string;
                        how?: string;
                        fallback?: string;
                        notes?: string;
                      };
                      if (!r.ok) throw new Error("提案に失敗しました");
                      const goal = j.goal?.trim() ?? "";
                      if (!goal) throw new Error("提案が空でした");
                      setGoalDraft(goal);
                      const descParts = [
                        j.action ? `やること: ${j.action}` : "",
                        j.why ? `なぜ: ${j.why}` : "",
                        j.notes ?? "",
                      ].filter(Boolean);
                      await onUpdate({
                        goal,
                        description: descParts.join("\n") || phase.description,
                      });
                    })
                    .catch(() => window.alert("AI提案に失敗しました。もう一度お試しください。"))
                    .finally(() => setGoalAiBusy(false));
                }}
                className="text-[10px] font-semibold text-orange-700 disabled:opacity-50"
              >
                {goalAiBusy ? "提案中…" : "✨ AI提案"}
              </button>
            ) : null}
          </div>
          <input
            readOnly={!canEdit}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
            placeholder="例：ターゲットと直接10人話す"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            onBlur={() => {
              if (canEdit && goalDraft !== (phase.goal ?? "")) void onUpdate({ goal: goalDraft });
            }}
          />
        </div>

        {phase.description?.trim() ? (
          <div className="mx-4 mb-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-violet-900">このフェーズでやること</p>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-700">{phase.description}</p>
          </div>
        ) : null}

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
          onOpenIssue={onOpenIssue}
        />
      </aside>
    </>
  );
}
