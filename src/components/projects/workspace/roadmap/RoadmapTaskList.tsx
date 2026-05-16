"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import type { PhaseTask } from "@/lib/roadmap/types";

type Props = {
  phaseId: string;
  tasks: PhaseTask[];
  canEdit: boolean;
  onToggleDone: (taskId: string, nextStatus: "todo" | "done") => void;
  onToggleToday: (taskId: string, next: boolean) => void;
  onCreate: (phaseId: string, title: string) => Promise<void>;
};

export function RoadmapTaskList({ phaseId, tasks, canEdit, onToggleDone, onToggleToday, onCreate }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const done = tasks.filter((t) => t.status === "done").length;

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
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          タスク ({done}/{tasks.length})
        </span>
        {canEdit ? (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-violet-600 hover:underline">
            + 追加
          </button>
        ) : null}
      </div>

      {adding ? (
        <form onSubmit={(e) => void submit(e)} className="mb-3 flex gap-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タスク名"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
          />
          <button type="submit" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white">
            追加
          </button>
        </form>
      ) : null}

      {tasks.length === 0 && !adding ? (
        <p className="text-sm text-gray-500">
          {canEdit ? (
            <button type="button" onClick={() => setAdding(true)} className="text-violet-600 hover:underline">
              + タスクを追加
            </button>
          ) : (
            "タスクはまだありません"
          )}
        </p>
      ) : null}

      <ul>
        {tasks.map((task) => (
          <li key={task.id} className="group flex items-center gap-3 border-b border-gray-100 py-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={() =>
                onToggleDone(task.id, task.status === "done" ? "todo" : "done")
              }
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                task.status === "done" ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
              }`}
            >
              {task.status === "done" ? <Check className="h-3 w-3 text-white" /> : null}
            </button>
            <span
              className={`flex-1 text-sm ${
                task.status === "done" ? "text-gray-400 line-through" : "text-gray-800"
              }`}
            >
              {task.title}
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void onToggleToday(task.id, !task.isToday)}
                className={`rounded-full px-2 py-0.5 text-xs transition-opacity ${
                  task.isToday
                    ? "bg-violet-100 text-violet-700 opacity-100"
                    : "border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100"
                }`}
              >
                {task.isToday ? "今日" : "今日に設定"}
              </button>
            ) : task.isToday ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">今日</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
