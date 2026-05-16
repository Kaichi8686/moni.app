"use client";

import type { IssueStatus, ProjectStatus } from "@/lib/workspace/types";

const projectLabels: Record<ProjectStatus, string> = {
  backlog: "未着手",
  planned: "計画中",
  in_progress: "進行中",
  paused: "保留",
  completed: "完了",
  cancelled: "中止",
};

const issueLabels: Record<IssueStatus, string> = {
  backlog: "バックログ",
  todo: "やること",
  in_progress: "進行中",
  in_review: "レビュー",
  done: "完了",
  cancelled: "中止",
};

const projectTone: Record<ProjectStatus, string> = {
  backlog: "bg-zinc-100 text-zinc-600",
  planned: "bg-sky-50 text-sky-700",
  in_progress: "bg-indigo-50 text-[#5E6AD2]",
  paused: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
};

const issueTone: Record<IssueStatus, string> = {
  backlog: "bg-zinc-100 text-zinc-600",
  todo: "bg-sky-50 text-sky-700",
  in_progress: "bg-indigo-50 text-[#5E6AD2]",
  in_review: "bg-violet-50 text-violet-800",
  done: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${projectTone[status]}`}>
      {projectLabels[status]}
    </span>
  );
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${issueTone[status]}`}>
      {issueLabels[status]}
    </span>
  );
}
