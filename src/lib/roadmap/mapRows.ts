import type { PhaseColor, PhaseStatus, PhaseTask, Priority, RoadmapBusinessType, RoadmapPhase, TaskStatus } from "@/lib/roadmap/types";

export type PhaseRowDb = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  goal?: string | null;
  status: string;
  start_date: string;
  end_date: string;
  color: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type PhaseTaskRowDb = {
  id: string;
  phase_id: string;
  project_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: string;
  is_today: boolean;
  created_at: string;
  updated_at: string;
};

function mapPhaseStatus(s: string): PhaseStatus {
  if (s === "in_progress" || s === "paused" || s === "completed" || s === "planned") return s;
  if (s === "backlog") return "planned";
  return "planned";
}

function mapTaskStatus(s: string): TaskStatus {
  if (s === "todo" || s === "in_progress" || s === "done" || s === "cancelled") return s;
  return "todo";
}

function mapPriority(s: string): Priority {
  if (s === "urgent" || s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function mapColor(c: string): PhaseColor {
  const allowed: PhaseColor[] = ["purple", "blue", "green", "amber", "red", "gray"];
  return allowed.includes(c as PhaseColor) ? (c as PhaseColor) : "purple";
}

export function mapPhaseTaskRow(row: PhaseTaskRowDb): PhaseTask {
  return {
    id: row.id,
    phaseId: row.phase_id,
    projectId: row.project_id,
    title: row.title,
    status: mapTaskStatus(row.status),
    assigneeId: row.assignee_id ?? undefined,
    dueDate: row.due_date ?? undefined,
    priority: mapPriority(row.priority),
    isToday: row.is_today,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function nestPhasesWithTasks(phaseRows: PhaseRowDb[], taskRows: PhaseTaskRowDb[]): RoadmapPhase[] {
  const byPhase = new Map<string, PhaseTask[]>();
  for (const tr of taskRows) {
    const t = mapPhaseTaskRow(tr);
    const list = byPhase.get(tr.phase_id) ?? [];
    list.push(t);
    byPhase.set(tr.phase_id, list);
  }
  return phaseRows
    .map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      goal: row.goal?.trim() || undefined,
      description: row.description?.trim() || undefined,
      status: mapPhaseStatus(row.status),
      startDate: row.start_date,
      endDate: row.end_date,
      color: mapColor(row.color),
      order: row.order,
      tasks: byPhase.get(row.id) ?? [],
    }))
    .sort((a, b) => a.order - b.order);
}

export function parseRoadmapBusinessType(v: string | null | undefined): RoadmapBusinessType {
  const allowed: RoadmapBusinessType[] = ["food", "retail", "event", "education", "app", "research", "other"];
  if (v && allowed.includes(v as RoadmapBusinessType)) return v as RoadmapBusinessType;
  return "other";
}

export function phaseTaskDoneRatio(phases: RoadmapPhase[]): number {
  const all = phases.flatMap((p) => p.tasks);
  if (all.length === 0) return 0;
  return Math.round((all.filter((t) => t.status === "done").length / all.length) * 100);
}
