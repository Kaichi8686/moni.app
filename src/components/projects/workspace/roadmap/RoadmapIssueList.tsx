"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import { isIssueDueToday } from "@/lib/roadmap/mergeWithIssues";
import type { Issue, IssueStatus } from "@/lib/workspace/types";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";

type Props = {
  projectId: string;
  phaseId: string;
  issues: Issue[];
  canEdit: boolean;
  onToggleDone: (issueId: string, nextStatus: IssueStatus) => void;
  onSetDueToday: (issueId: string, today: boolean) => void;
  onCreate: (phaseId: string, title: string) => Promise<void>;
  onOpenIssue?: (issue: Issue) => void;
};

export function RoadmapIssueList({
  projectId,
  phaseId,
  issues,
  canEdit,
  onToggleDone,
  onSetDueToday,
  onCreate,
  onOpenIssue,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const sorted = sortIssuesByDueDate(issues);
  const done = sorted.filter((i) => i.status === "done").length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    await onCreate(phaseId, t);
    setTitle("");
    setAdding(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          課題 ({done}/{sorted.length})
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/issues`}
            className="inline-flex items-center gap-0.5 text-[11px] text-violet-600 hover:underline"
          >
            課題タブ
            <ExternalLink className="h-3 w-3" />
          </Link>
          {canEdit ? (
            <button type="button" onClick={() => setAdding(true)} className="text-xs text-violet-600 hover:underline">
              + 追加
            </button>
          ) : null}
        </div>
      </div>
      {adding ? (
        <form onSubmit={(e) => void submit(e)} className="mb-3 flex gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="課題名"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
          />
          <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white">
            追加
          </button>
        </form>
      ) : null}

      {sorted.length === 0 && !adding ? (
        <p className="text-sm text-gray-500">
          {canEdit ? (
            <button type="button" onClick={() => setAdding(true)} className="text-violet-600 hover:underline">
              + 課題を追加
            </button>
          ) : (
            "このフェーズの課題はまだありません"
          )}
        </p>
      ) : null}

      <ul>
        {sorted.map((issue) => {
          const dueToday = isIssueDueToday(issue.dueDate);
          return (
            <li key={issue.id} className="group flex items-center gap-3 border-b border-gray-100 py-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onToggleDone(issue.id, issue.status === "done" ? "todo" : "done")}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  issue.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                }`}
              >
                {issue.status === "done" ? <Check className="h-3 w-3 text-white" /> : null}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIssue?.(issue);
                }}
                className={`min-w-0 flex-1 text-left text-sm hover:text-violet-700 ${
                  issue.status === "done" ? "text-gray-400 line-through" : "text-gray-800"
                } ${onOpenIssue ? "cursor-pointer" : "cursor-default"}`}
              >
                {issue.title}
              </button>
              {onOpenIssue ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenIssue(issue);
                  }}
                  className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-violet-50 hover:text-violet-600"
                  aria-label="詳細を見る"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void onSetDueToday(issue.id, !dueToday)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs transition-opacity ${
                    dueToday
                      ? "bg-violet-100 text-violet-700 opacity-100"
                      : "border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {dueToday ? "今日" : "今日に設定"}
                </button>
              ) : dueToday ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">今日</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
