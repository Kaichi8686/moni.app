/** Linear-style workspace domain (project_phases / project_issues / projects.linear_status) */

export type ProjectStatus = "backlog" | "planned" | "in_progress" | "paused" | "completed" | "cancelled";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
export type Priority = "no_priority" | "urgent" | "high" | "medium" | "low";

import type { IssueWorkflow } from "@/lib/workspace/issueWorkflow";
export type { IssueWorkflow, IssueWorkflowStep } from "@/lib/workspace/issueWorkflow";

/** Built-in genres, or custom ids like `custom_ab12cd34` */
export type BuiltinTaskGenre = "think" | "make" | "talk" | "spread" | "run";
export type TaskGenre = BuiltinTaskGenre | (string & {});

export type CustomTaskGenreDef = {
  id: string;
  labelJa: string;
  labelEn?: string;
  hintJa?: string;
  hintEn?: string;
  /** Maps to icon background class, e.g. bg-rose-500 */
  colorKey?: string;
};

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
  /** @deprecated 互換用。assigneeIds[0] と同じ */
  assigneeId?: string;
  /** 担当メンバー（複数可） */
  assigneeIds: string[];
  projectId: string;
  phaseId?: string;
  dueDate?: string;
  beginAt?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  labels: string[];
  genre: TaskGenre;
  workspaceText: string;
  attachments: string[];
  submittedAt?: string;
  /** 旧5ステップが残っていて、作業スペースへ移す必要がある */
  legacyWorkflow?: boolean;
  workflow?: IssueWorkflow;
  /** workflow.completionAnswer のショートカット */
  completionAnswer?: string;
}

export interface Phase {
  id: string;
  projectId: string;
  title: string;
  goal?: string;
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
