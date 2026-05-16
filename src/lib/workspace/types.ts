/** Linear-style workspace domain (project_phases / project_issues / projects.linear_status) */

export type ProjectStatus = "backlog" | "planned" | "in_progress" | "paused" | "completed" | "cancelled";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
export type Priority = "no_priority" | "urgent" | "high" | "medium" | "low";

export interface Member {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "owner" | "member" | "viewer";
}

export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  assigneeId?: string;
  projectId: string;
  phaseId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  labels: string[];
}

export interface Phase {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  color: string;
  issues: Issue[];
  order: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  estimatedCompletionDate?: string;
  members: Member[];
  phases: Phase[];
  leadId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TimelineZoom = "month" | "week" | "quarter";

export const PHASE_COLOR_PRESETS = [
  { key: "gray", className: "bg-zinc-400" },
  { key: "blue", className: "bg-sky-500" },
  { key: "purple", className: "bg-[#5E6AD2]" },
  { key: "green", className: "bg-emerald-500" },
  { key: "amber", className: "bg-amber-400" },
] as const;
