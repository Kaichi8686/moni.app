"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isIssueDueToday } from "@/lib/roadmap/mergeWithIssues";
import type { RoadmapPhaseWithIssues } from "@/lib/roadmap/mergeWithIssues";
import type { Issue } from "@/lib/workspace/types";

export function RoadmapTodayTodo({
  phases,
  issues,
  projectId,
  canEdit,
}: {
  phases: RoadmapPhaseWithIssues[];
  issues: Issue[];
  projectId: string;
  canEdit: boolean;
}) {
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const todayIssues = useMemo(
    () => issues.filter((i) => i.status !== "done" && i.status !== "cancelled" && isIssueDueToday(i.dueDate)),
    [issues],
  );
  const legacyToday = phases.flatMap((p) => p.tasks).filter((t) => t.isToday && t.status !== "done");
  const activePhase = phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "planned");

  async function generateSuggestion() {
    setLoading(true);
    try {
      const payload = phases.map((p) => ({
        title: p.title,
        goal: p.goal,
        status: p.status,
        tasks: [
          ...p.linkedIssues.map((i) => ({ title: i.title, status: i.status })),
          ...p.tasks.map((t) => ({ title: t.title, status: t.status })),
        ],
      }));
      const res = await fetch("/api/roadmap/suggest-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phases: payload }),
      });
      const data = (await res.json()) as { suggestion?: string };
      setAiSuggestion(data.suggestion ?? null);
    } finally {
      setLoading(false);
    }
  }

  const headline =
    todayIssues.length > 0
      ? todayIssues[0].title
      : legacyToday.length > 0
        ? legacyToday[0].title
        : aiSuggestion ?? activePhase?.goal ?? "フェーズを開いて課題を追加するか、AIに提案してもらおう";

  return (
    <div className="mx-0 flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="text-2xl" aria-hidden>
        📍
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium text-violet-600">今日やること</p>
        <p className="truncate text-sm font-medium text-gray-900">{headline}</p>
        {todayIssues.length > 1 ? (
          <p className="mt-0.5 text-[11px] text-gray-500">他 {todayIssues.length - 1} 件（期限が今日）</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        {todayIssues.length > 0 ? (
          <Link
            href={`/projects/${projectId}/issues`}
            className="text-[11px] font-medium text-violet-700 hover:underline"
          >
            課題タブで開く
          </Link>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => void generateSuggestion()}
            disabled={loading}
            className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs text-violet-600 transition-colors duration-150 hover:bg-violet-100 disabled:opacity-50"
          >
            {loading ? "考え中..." : "AIに提案してもらう"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
