import type { RoadmapStepListItem, RoadmapStepListTask } from "@/components/projects/workspace/roadmap/RoadmapStepList";
import { splitRoadmapPathLayout } from "@/lib/roadmap/pathLayout";
import type { PhaseStatus, PhaseTask } from "@/lib/roadmap/types";
import { isIssueAssignedTo } from "@/lib/workspace/issueAssignees";
import { isoToDateInput, stripWorkMarker } from "@/lib/workspace/issueWork";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
import type { Issue } from "@/lib/workspace/types";

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

function plainIssueDescription(issue: Pick<Issue, "description" | "workspaceText">): string | undefined {
  const fromDescription = stripWorkMarker(issue.description).trim();
  if (fromDescription) return fromDescription;
  // workspaceText が JSON っぽい場合は出さない
  const text = (issue.workspaceText ?? "").trim();
  if (!text) return undefined;
  if (text.startsWith("{") || text.includes("---oni-") || text.includes("---moni-")) return undefined;
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

/**
 * 本線ステップだけを縦リスト用の行に並べる（横置きは出さない）。
 * 課題は「自分が担当の未完了」を期限近い順で最大3件。
 */
export function buildStepListItems(
  phases: StepListPhaseInput[],
  options?: {
    issues?: Issue[];
    /** 自分が担当の課題だけに絞る（未指定なら担当フィルタなし） */
    assigneeUserId?: string | null;
    nextMoveLabel?: string;
    dueLabelPrefix?: string;
  },
): { items: RoadmapStepListItem[]; currentMainIndex: number; currentStepId: string | null } {
  const { main } = splitRoadmapPathLayout(phases);
  const inProgress = main.findIndex((step) => toPhaseStatus(step.status) === "in_progress");
  const firstOpen = main.findIndex((step) => toPhaseStatus(step.status) !== "completed");
  const currentMainIndex = Math.max(0, inProgress >= 0 ? inProgress : firstOpen >= 0 ? firstOpen : 0);
  const issues = options?.issues ?? [];
  const assigneeUserId = options?.assigneeUserId;
  const nextMoveLabel = options?.nextMoveLabel ?? "Next move";
  const dueLabelPrefix = options?.dueLabelPrefix ?? "Due";

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
        dueLabelPrefix,
        assigneeUserId,
      }),
    };
  });

  const currentStepId = items[currentMainIndex]?.id ?? null;
  return { items, currentMainIndex, currentStepId };
}

function collectFocusTasksForPhase(
  phase: StepListPhaseInput,
  issues: Issue[],
  opts: {
    isCurrent: boolean;
    nextMoveLabel: string;
    dueLabelPrefix: string;
    assigneeUserId?: string | null;
  },
): RoadmapStepListTask[] {
  const fromIssues = sortIssuesByDueDate(
    issues.filter((issue) => {
      if (issue.phaseId !== phase.id) return false;
      if (issue.status === "cancelled" || issue.status === "done") return false;
      if (opts.assigneeUserId) {
        return isIssueAssignedTo(issue, opts.assigneeUserId);
      }
      return true;
    }),
  )
    .slice(0, MAX_FOCUS_TASKS)
    .map((issue) => {
      const dueDay = isoToDateInput(issue.dueDate);
      return {
        id: `issue-${issue.id}`,
        issueId: issue.id,
        title: issue.title,
        description: plainIssueDescription(issue),
        dueLabel: dueDay ? `${opts.dueLabelPrefix} ${dueDay}` : undefined,
        status: "todo" as const,
      };
    });

  if (fromIssues.length > 0) {
    return fromIssues.map((task, index) => {
      if (opts.isCurrent && index === 0) {
        return { ...task, status: "active" as const, badge: opts.nextMoveLabel };
      }
      return task;
    });
  }

  // 担当課題が無いときは phase_tasks の未完了をフォールバック（担当フィルタ対象外）
  if (opts.assigneeUserId) return [];

  return (phase.tasks ?? [])
    .filter((task) => task.status !== "cancelled" && task.status !== "done")
    .slice(0, MAX_FOCUS_TASKS)
    .map((task, index) => ({
      id: `task-${task.id}`,
      title: task.title,
      status: (opts.isCurrent && index === 0 ? "active" : "todo") as "active" | "todo",
      badge: opts.isCurrent && index === 0 ? opts.nextMoveLabel : undefined,
    }));
}
