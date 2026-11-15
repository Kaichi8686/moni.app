import type { RoadmapStepListItem, RoadmapStepListTask } from "@/components/projects/workspace/roadmap/RoadmapStepList";
import { sideSlotsForParent, splitRoadmapPathLayout } from "@/lib/roadmap/pathLayout";
import type { PhaseStatus, PhaseTask } from "@/lib/roadmap/types";

type IssueLike = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  phaseId?: string | null;
};

/** overview / editor 双方のフェーズ形を受けられる最小形 */
export type StepListPhaseInput = {
  id: string;
  title: string;
  goal?: string;
  description?: string;
  status: string;
  order: number;
  sideOf?: string | null;
  lane?: number | null;
  tasks?: PhaseTask[];
};

function toPhaseStatus(status: string): PhaseStatus {
  if (status === "completed" || status === "in_progress" || status === "paused" || status === "planned") {
    return status;
  }
  if (status === "done") return "completed";
  if (status === "doing") return "in_progress";
  return "planned";
}

/**
 * 本線＋横置きを縦リスト用の行に並べる。
 * タスクは phase_tasks と、フェーズに紐づく課題を合成する。
 */
export function buildStepListItems(
  phases: StepListPhaseInput[],
  options?: {
    issues?: IssueLike[];
    nextMoveLabel?: string;
  },
): { items: RoadmapStepListItem[]; currentMainIndex: number } {
  const { main, bySideOf } = splitRoadmapPathLayout(phases);
  const inProgress = main.findIndex((step) => step.status === "in_progress");
  const firstOpen = main.findIndex((step) => step.status !== "completed");
  const currentMainIndex = Math.max(0, inProgress >= 0 ? inProgress : firstOpen >= 0 ? firstOpen : 0);
  const issues = options?.issues ?? [];
  const nextMoveLabel = options?.nextMoveLabel ?? "Next move";

  const items: RoadmapStepListItem[] = [];

  main.forEach((phase, mainIndex) => {
    const status = toPhaseStatus(phase.status);
    items.push({
      id: phase.id,
      title: phase.title,
      goal: phase.goal,
      description: phase.description,
      status,
      stepNumber: mainIndex + 1,
      tasks: collectTasksForPhase(phase, issues, {
        isCurrent:
          status === "in_progress" ||
          (status !== "completed" && mainIndex === currentMainIndex),
        nextMoveLabel,
      }),
    });

    for (const side of sideSlotsForParent(bySideOf.get(phase.id) ?? [])) {
      const sideStatus = toPhaseStatus(side.status);
      items.push({
        id: side.id,
        title: side.title,
        goal: side.goal,
        description: side.description,
        status: sideStatus,
        stepNumber: mainIndex + 1,
        nested: true,
        tasks: collectTasksForPhase(side, issues, {
          isCurrent: sideStatus === "in_progress",
          nextMoveLabel,
        }),
      });
    }
  });

  return { items, currentMainIndex };
}

function collectTasksForPhase(
  phase: StepListPhaseInput,
  issues: IssueLike[],
  opts: { isCurrent: boolean; nextMoveLabel: string },
): RoadmapStepListTask[] {
  const fromLegacy = (phase.tasks ?? [])
    .filter((task) => task.status !== "cancelled")
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      status: (task.status === "done" ? "done" : "todo") as "done" | "todo",
    }));

  const fromIssues = issues
    .filter((issue) => issue.phaseId === phase.id && issue.status !== "cancelled")
    .map((issue) => ({
      id: `issue-${issue.id}`,
      title: issue.title,
      description: issue.description?.trim() || undefined,
      status: (issue.status === "done" ? "done" : "todo") as "done" | "todo",
    }));

  // 課題があれば課題を優先、なければ phase_tasks
  const base = fromIssues.length > 0 ? fromIssues : fromLegacy;
  let markedNext = false;
  return base.map((task) => {
    if (task.status === "done") return { ...task, status: "done" as const };
    if (opts.isCurrent && !markedNext) {
      markedNext = true;
      return { ...task, status: "active" as const, badge: opts.nextMoveLabel };
    }
    return { ...task, status: "todo" as const };
  });
}
