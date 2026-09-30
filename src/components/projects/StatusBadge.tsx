"use client";

import type { IssueStatus, ProjectStatus } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const projectTone: Record<ProjectStatus, string> = {
  backlog: "bg-zinc-100 text-zinc-600",
  planned: "bg-[var(--brand-soft,#fff4f0)] text-[var(--brand-ink,#9a3412)]",
  in_progress: "bg-[var(--brand-muted,#ffd9cc)] text-[var(--brand-ink,#9a3412)]",
  paused: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
};

const issueTone: Record<IssueStatus, string> = {
  backlog: "bg-zinc-100 text-zinc-600",
  todo: "bg-[var(--brand-soft,#fff4f0)] text-[var(--brand-ink,#9a3412)]",
  in_progress: "bg-[var(--brand-muted,#ffd9cc)] text-[var(--brand-ink,#9a3412)]",
  in_review: "bg-amber-50 text-amber-800",
  done: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-red-50 text-red-700",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { tx } = useI18n();
  const labels: Record<ProjectStatus, string> = {
    backlog: tx("未着手", "Backlog"),
    planned: tx("計画中", "Planned"),
    in_progress: tx("進行中", "In progress"),
    paused: tx("保留", "Paused"),
    completed: tx("完了", "Completed"),
    cancelled: tx("中止", "Cancelled"),
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${projectTone[status]}`}>
      {labels[status]}
    </span>
  );
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const { tx } = useI18n();
  const labels: Record<IssueStatus, string> = {
    backlog: tx("あとで", "Later"),
    todo: tx("やること", "To do"),
    in_progress: tx("進行中", "In progress"),
    in_review: tx("確認中", "In review"),
    done: tx("完了", "Done"),
    cancelled: tx("中止", "Cancelled"),
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${issueTone[status]}`}>
      {labels[status]}
    </span>
  );
}
