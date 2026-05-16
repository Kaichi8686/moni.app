"use client";

import { useState } from "react";
import type { RoadmapPhase } from "@/lib/roadmap/types";

export function RoadmapTodayTodo({ phases, canEdit }: { phases: RoadmapPhase[]; canEdit: boolean }) {
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const todayTasks = phases.flatMap((p) => p.tasks).filter((t) => t.isToday && t.status !== "done");
  const activePhase = phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "planned");

  async function generateSuggestion() {
    setLoading(true);
    try {
      const res = await fetch("/api/roadmap/suggest-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phases }),
      });
      const data = (await res.json()) as { suggestion?: string };
      setAiSuggestion(data.suggestion ?? null);
    } finally {
      setLoading(false);
    }
  }

  const headline =
    todayTasks.length > 0
      ? todayTasks[0].title
      : aiSuggestion ?? activePhase?.goal ?? "タスクを追加するか、AIに提案してもらおう";

  return (
    <div className="mx-0 flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="text-2xl" aria-hidden>
        📍
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-medium text-violet-600">今日やること</p>
        <p className="truncate text-sm font-medium text-gray-900">{headline}</p>
        {todayTasks.length > 1 ? (
          <p className="mt-0.5 text-[11px] text-gray-500">他 {todayTasks.length - 1} 件</p>
        ) : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={() => void generateSuggestion()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-violet-300 px-3 py-1.5 text-xs text-violet-600 transition-colors duration-150 hover:bg-violet-100 disabled:opacity-50"
        >
          {loading ? "考え中..." : "AIに提案してもらう"}
        </button>
      ) : null}
    </div>
  );
}
