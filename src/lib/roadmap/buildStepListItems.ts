import type { RoadmapStepListItem, RoadmapStepListTask } from "@/components/projects/workspace/roadmap/RoadmapStepList";
import { splitRoadmapPathLayout } from "@/lib/roadmap/pathLayout";
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

const MAX_FOCUS_TASKS = 3;

function toPhaseStatus(status: string): PhaseStatus {
  if (status === "completed" || status === "in_progress" || status === "paused" || status === "planned") {
    return status;
  }
  if (status === "done") return "completed";
  if (status === "doing") return "in_progress";
  return "planned";
}

/**
 * 本線ステップだけを縦リスト用の行に並べる（横置きは出さない）。
 * 課題は「今やるべき」未完了を最大3件。
 */
export function buildStepListItems(
  phases: StepListPhaseInput[],
  options?: {
    issues?: IssueLike[];
    nextMoveLabel?: string;
  },
): { items: RoadmapStepListItem[]; currentMainIndex: number; currentStepId: string | null } {
  const { main } = splitRoadmapPathLayout(phases);
  const inProgress = main.findIndex((step) => toPhaseStatus(step.status) === "in_progress");
  const firstOpen = main.findIndex((step) => toPhaseStatus(step.status) !== "completed");
  const currentMainIndex = Math.max(0, inProgress >= 0 ? inProgress : firstOpen >= 0 ? firstOpen : 0);
  const issues = options?.issues ?? [];
  const nextMoveLabel = options?.nextMoveLabel ?? "Next move";

  const items: RoadmapStepListItem[] = main.map((phase, mainIndex) => {
    const status = toPhaseStatus(phase.status);
    const isCurrent =
      status === "in_progress" || (status !== "completed" && mainIndex === currentMainIndex);
    return {
      id: phase.id,
      title: phase.title,
      goal: phase.goal,
      description: phase.description,
      status,
      stepNumber: mainIndex + 1,
      tasks: collectFocusTasksForPhase(phase, issues, {
        isCurrent,
        nextMoveLabel,
      }),
    };
  });

  const currentStepId = items[currentMainIndex]?.id ?? null;
  return { items, currentMainIndex, currentStepId };
}

function collectFocusTasksForPhase(
  phase: StepListPhaseInput,
  issues: IssueLike[],
  opts: { isCurrent: boolean; nextMoveLabel: string },
): RoadmapStepListTask[] {
  const fromLegacy = (phase.tasks ?? [])
    .filter((task) => task.status !== "cancelled" && task.status !== "done")
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      status: "todo" as const,
    }));

  const fromIssues = issues
    .filter(
      (issue) =>
        issue.phaseId === phase.id &&
        issue.status !== "cancelled" &&
        issue.status !== "done",
    )
    .map((issue) => ({
      id: `issue-${issue.id}`,
      title: issue.title,
      description: issue.description?.trim() || undefined,
      status: "todo" as const,
    }));

  // 課題があれば課題を優先、なければ phase_tasks。今やるべきは最大3件。
  const base = (fromIssues.length > 0 ? fromIssues : fromLegacy).slice(0, MAX_FOCUS_TASKS);
  return base.map((task, index) => {
    if (opts.isCurrent && index === 0) {
      return { ...task, status: "active" as const, badge: opts.nextMoveLabel };
    }
    return { ...task, status: "todo" as const };
  });
}
