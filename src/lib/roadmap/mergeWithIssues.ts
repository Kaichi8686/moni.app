import type { Issue } from "@/lib/workspace/types";
import type { RoadmapPhase } from "@/lib/roadmap/types";
import type { TimelinePhaseLike } from "@/components/roadmap/TimelineBar";

export type RoadmapPhaseWithIssues = RoadmapPhase & {
  linkedIssues: Issue[];
};

export function mergeRoadmapPhasesWithIssues(phases: RoadmapPhase[], issues: Issue[]): RoadmapPhaseWithIssues[] {
  return phases.map((p) => ({
    ...p,
    linkedIssues: issues.filter((i) => i.phaseId === p.id),
  }));
}

export function toTimelinePhase(p: RoadmapPhaseWithIssues): TimelinePhaseLike {
  const fromIssues = p.linkedIssues.map((i) => ({
    status: i.status === "done" || i.status === "cancelled" ? "done" : "todo",
  }));
  const fromLegacy = p.tasks.map((t) => ({ status: t.status }));
  return {
    id: p.id,
    title: p.title,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    tasks: [...fromIssues, ...fromLegacy],
  };
}

export function isIssueDueToday(dueDate?: string): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
