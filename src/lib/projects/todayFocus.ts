import type { TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import { pickFocusStep, sortedRoadmapSteps, type RoadmapStepFocusFields } from "@/lib/projects/roadmapFocus";
import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import { applyTodaySlotOverrides, pickTodayThree, type TaskLikeForPick } from "@/lib/projects/todayThree";

function toPick(tasks: TaskPanelRow[]): TaskLikeForPick[] {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    due_date: t.due_date,
    status: t.status,
    meta: t.meta,
    roadmap_step_id: t.roadmap_step_id,
    assignee_id: t.assignee_id,
  }));
}

function priorityRank(p: TaskPanelRow["priority"]): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

/** 「今日やること」用の1件：おすすめ枠 → フォーカスフェーズの未完了 → 全体の未完了 */
export function pickPrimaryTodayTask<T extends RoadmapStepFocusFields>(
  tasks: TaskPanelRow[],
  steps: T[],
): TaskPanelRow | null {
  const pick = toPick(tasks);
  const slots = applyTodaySlotOverrides(pickTodayThree(pick), pick);
  if (slots.important) {
    return tasks.find((t) => t.id === slots.important!.id) ?? null;
  }

  const focus = pickFocusStep(steps);
  if (focus) {
    const linked = tasks.filter((t) => t.roadmap_step_id === focus.id && normalizeTaskStatus(t.status) !== "done");
    if (linked.length > 0) {
      return [...linked].sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        const da = a.due_date ?? "\uffff";
        const db = b.due_date ?? "\uffff";
        return da.localeCompare(db);
      })[0];
    }
  }

  const pool = tasks.filter((t) => normalizeTaskStatus(t.status) !== "done");
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const da = a.due_date ?? "\uffff";
    const db = b.due_date ?? "\uffff";
    return da.localeCompare(db);
  })[0];
}

export function focusPhaseIndex1Based<T extends RoadmapStepFocusFields>(steps: T[]): { current: number; total: number } {
  const list = sortedRoadmapSteps(steps);
  const focus = pickFocusStep(list);
  const total = list.length;
  if (!focus || total === 0) return { current: 0, total };
  const idx = list.findIndex((s) => s.id === focus.id);
  return { current: idx >= 0 ? idx + 1 : 0, total };
}
