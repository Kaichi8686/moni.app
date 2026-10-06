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
          やること ({done}/{sorted.length})
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/issues`}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--brand,#ff5c35)] hover:underline"
          >
            すべて見る
            <ExternalLink className="h-3 w-3" />
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs font-semibold text-[var(--brand,#ff5c35)] hover:underline"
            >
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
            placeholder="例：ポスターの案を書く"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-[var(--brand,#ff5c35)] focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand,#ff5c35)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-hover,#e04e2a)]"
          >
            追加
          </button>
        </form>
      ) : null}

      {sorted.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-[var(--brand-muted,#ffd9cc)] bg-[var(--brand-soft,#fff4f0)]/60 px-3 py-4">
          <p className="text-sm font-medium text-zinc-800">この段階のやることはまだありません</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            小さくてもいいので、次に進める一手を1つ書いてみましょう。
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 text-sm font-semibold text-[var(--brand,#ff5c35)] hover:underline"
            >
              + 最初のやることを追加
            </button>
          ) : null}
        </div>
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
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  issue.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                }`}
                aria-label={issue.status === "done" ? "未完了に戻す" : "完了にする"}
              >
                {issue.status === "done" ? <Check className="h-3 w-3 text-white" /> : null}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenIssue?.(issue);
                }}
                className={`min-w-0 flex-1 text-left text-sm hover:text-[var(--brand-ink,#9a3412)] ${
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
                  className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-[var(--brand-soft,#fff4f0)] hover:text-[var(--brand,#ff5c35)]"
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
                      ? "bg-[var(--brand-soft,#fff4f0)] text-[var(--brand-ink,#9a3412)] opacity-100"
                      : "border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {dueToday ? "今日" : "今日に設定"}
                </button>
              ) : dueToday ? (
                <span className="shrink-0 rounded-full bg-[var(--brand-soft,#fff4f0)] px-2 py-0.5 text-xs text-[var(--brand-ink,#9a3412)]">
                  今日
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
