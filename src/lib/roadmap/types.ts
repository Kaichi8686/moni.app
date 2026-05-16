/** ロードマップ v3（project_phases + phase_tasks） */

export type PhaseStatus = "planned" | "in_progress" | "paused" | "completed";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type Priority = "urgent" | "high" | "medium" | "low";
export type PhaseColor = "purple" | "blue" | "green" | "amber" | "red" | "gray";
export type RoadmapBusinessType = "food" | "retail" | "event" | "education" | "app" | "research" | "other";

export type PhaseTask = {
  id: string;
  phaseId: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
  priority: Priority;
  isToday: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoadmapPhase = {
  id: string;
  projectId: string;
  title: string;
  goal?: string;
  description?: string;
  status: PhaseStatus;
  startDate: string;
  endDate: string;
  color: PhaseColor;
  order: number;
  tasks: PhaseTask[];
};

export type RoadmapProjectMeta = {
  id: string;
  name: string;
  description?: string;
  roadmapBusinessType: RoadmapBusinessType;
  startDate?: string;
  targetDate?: string;
};
