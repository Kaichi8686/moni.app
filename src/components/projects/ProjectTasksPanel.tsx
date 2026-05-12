"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ProjectTaskMeta, TaskPriority, TaskStatus } from "@/lib/projects/types";
import { mergeTaskMeta, parseTaskMeta } from "@/lib/projects/taskMeta";
import { ProjectScheduleCalendar, type CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";

export type TaskPanelRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  roadmap_step_id: string | null;
  meta: unknown;
  updated_at: string;
};

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function dueBadge(dueDateStr: string | null): { text: string; tone: "urgent" | "soon" | "later" | "none" } {
  if (!dueDateStr) return { text: "", tone: "none" };
  const today = startOfDayLocal(new Date());
  const due = parseLocalDateKey(dueDateStr.slice(0, 10));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { text: `期限超過`, tone: "urgent" };
  if (diffDays === 0) return { text: "今日まで", tone: "urgent" };
  if (diffDays === 1) return { text: "明日まで", tone: "soon" };
  if (diffDays <= 7) return { text: `${diffDays}日後まで`, tone: "soon" };
  return { text: `${dueDateStr.slice(5).replace("-", "/")}まで`, tone: "later" };
}

function leftBorderClass(tone: ReturnType<typeof dueBadge>["tone"], priority: TaskPriority): string {
  if (tone === "urgent" || priority === "high") return "border-l-[6px] border-l-rose-500";
  if (tone === "soon" || priority === "medium") return "border-l-[6px] border-l-sky-500";
  return "border-l-[6px] border-l-zinc-300";
}

function badgeSurface(tone: ReturnType<typeof dueBadge>["tone"]): string {
  if (tone === "urgent") return "bg-rose-50 text-rose-800 ring-rose-100";
  if (tone === "soon") return "bg-sky-50 text-sky-800 ring-sky-100";
  if (tone === "later") return "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return "bg-zinc-50 text-zinc-500 ring-zinc-200";
}

function interactionMode(meta: ProjectTaskMeta): "choice" | "text" | "simple" {
  if (meta.inputKind === "choice" && meta.choiceOptions && meta.choiceOptions.length > 0) return "choice";
  if (meta.inputKind === "text") return "text";
  return "simple";
}

type Props = {
  projectId: string;
  tasks: TaskPanelRow[];
  uid: string | null;
  canEdit: boolean;
  onReload: () => void;
  onError: (msg: string) => void;
  schedules: CalendarSchedule[];
  scheduleSaving: boolean;
  onSaveSchedule: (payload: { title: string; description: string; startsAt: string; endsAt: string; attendees: string }) => Promise<void>;
};

export function ProjectTasksPanel({
  projectId,
  tasks,
  uid,
  canEdit,
  onReload,
  onError,
  schedules,
  scheduleSaving,
  onSaveSchedule,
}: Props) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [draftTitle, setDraftTitle] = useState("");
  const [choiceLocal, setChoiceLocal] = useState<Record<string, string>>({});
  const [textLocal, setTextLocal] = useState<Record<string, string>>({});

  const runBusy = useCallback(async (taskId: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(taskId));
    try {
      await fn();
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }, [onError, onReload]);

  const activeTasks = useMemo(() => {
    const list = tasks.filter((t) => t.status !== "done");
    return [...list].sort((a, b) => {
      const da = a.due_date ?? "\uffff";
      const db = b.due_date ?? "\uffff";
      if (da !== db) return da.localeCompare(db);
      return a.title.localeCompare(b.title, "ja");
    });
  }, [tasks]);

  const doneTasks = useMemo(() => {
    const list = tasks.filter((t) => t.status === "done");
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [tasks]);

  async function completeSimple(task: TaskPanelRow) {
    const client = supabase;
    if (!client || !canEdit) return;
    await runBusy(task.id, async () => {
      const { error } = await client.from("project_tasks").update({
        status: "done",
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);
      if (error) throw new Error(error.message);
    });
  }

  async function submitAnswer(task: TaskPanelRow, answer: string) {
    const client = supabase;
    if (!client || !canEdit || !answer.trim()) return;
    const meta = parseTaskMeta(task.meta);
    const next = mergeTaskMeta(meta, { answer: answer.trim() });
    await runBusy(task.id, async () => {
      const { error } = await client.from("project_tasks").update({
        meta: next,
        status: "done",
        updated_at: new Date().toISOString(),
      }).eq("id", task.id);
      if (error) throw new Error(error.message);
    });
  }

  async function addQuickTask(e: FormEvent) {
    e.preventDefault();
    const client = supabase;
    if (!client || !uid || !canEdit || !draftTitle.trim()) return;
    const title = draftTitle.trim();
    setDraftTitle("");
    try {
      const { error } = await client.from("project_tasks").insert({
        project_id: projectId,
        title,
        description: "",
        status: "todo",
        priority: "medium",
        due_date: null,
        created_by: uid,
        ai_generated: false,
        roadmap_step_id: null,
      });
      if (error) {
        onError(error.message);
        return;
      }
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "タスクの追加に失敗しました。");
    }
  }

  return (
    <section className="mx-auto w-full max-w-[420px] space-y-5 pb-4 md:max-w-md">
      {canEdit ? (
        <form onSubmit={(e) => void addQuickTask(e)} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-md">
          <p className="text-xs font-semibold text-zinc-700">タスクを追加</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="やることをひとことで"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <button
              type="submit"
              disabled={!draftTitle.trim()}
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              追加
            </button>
          </div>
        </form>
      ) : null}

      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-900">期限が近い</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">未完了のタスク。選んだあと「回答する」で完了に移ります。</p>
        <ul className="mt-3 space-y-3">
          {activeTasks.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-10 text-center text-[13px] text-zinc-500">
              タスクはありません。上から追加するか、ロードマップから具体タスクを置いてください。
            </li>
          ) : null}
          {activeTasks.map((task) => {
            const meta = parseTaskMeta(task.meta);
            const mode = interactionMode(meta);
            const due = dueBadge(task.due_date);
            const border = leftBorderClass(due.tone, task.priority);
            const busy = busyIds.has(task.id);

            const selectedChip = choiceLocal[task.id] ?? meta.answer ?? "";
            const textVal = textLocal[task.id] ?? "";

            return (
              <li
                key={task.id}
                className={`relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md ${border}`}
              >
                <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
                  <h3 className="pr-1 text-[15px] font-bold leading-snug text-zinc-900">{task.title}</h3>
                  {due.text ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeSurface(due.tone)}`}>
                      {due.text}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 border-t border-zinc-100 px-3 py-3">
                  {task.description.trim() ? (
                    <p className="text-[13px] leading-relaxed text-zinc-600">{task.description}</p>
                  ) : null}

                  {mode === "choice" && meta.choiceOptions ? (
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {meta.choiceOptions.map((opt) => {
                          const on = selectedChip === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={!canEdit || busy}
                              onClick={() => setChoiceLocal((prev) => ({ ...prev, [task.id]: opt }))}
                              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                                on
                                  ? "border-violet-600 bg-violet-50 text-violet-950 ring-1 ring-violet-200"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit || busy || !selectedChip}
                        onClick={() => void submitAnswer(task, selectedChip)}
                        className="mt-3 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50/80 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:opacity-40"
                      >
                        {busy ? "保存中…" : "回答する"}
                      </button>
                    </div>
                  ) : null}

                  {mode === "text" ? (
                    <div>
                      <textarea
                        className="min-h-[88px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:bg-white"
                        placeholder={meta.placeholder?.trim() || "ここに入力…"}
                        disabled={!canEdit || busy}
                        value={textVal}
                        onChange={(e) => setTextLocal((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={!canEdit || busy || !textVal.trim()}
                        onClick={() => void submitAnswer(task, textVal)}
                        className="mt-3 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50/80 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:opacity-40"
                      >
                        {busy ? "保存中…" : "回答する"}
                      </button>
                    </div>
                  ) : null}

                  {mode === "simple" ? (
                    <button
                      type="button"
                      disabled={!canEdit || busy}
                      onClick={() => void completeSimple(task)}
                      className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50/80 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:opacity-40"
                    >
                      {busy ? "保存中…" : "完了にする"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className="text-[13px] font-bold text-zinc-400">完了済み</h2>
        <ul className="mt-3 space-y-2">
          {doneTasks.length === 0 ? (
            <li className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-400">まだありません</li>
          ) : null}
          {doneTasks.map((task) => {
            const meta = parseTaskMeta(task.meta);
            const line = meta.answer?.trim() || task.description.trim() || "—";
            return (
              <li key={task.id} className="rounded-2xl border border-zinc-100 bg-zinc-100/60 px-3 py-3 opacity-75 shadow-sm">
                <p className="text-sm font-semibold text-zinc-400 line-through decoration-zinc-300">{task.title}</p>
                <p className="mt-1 text-[13px] font-medium text-zinc-500">{line}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <details className="group rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            チームのスケジュール
            <span className="text-xs font-normal text-zinc-400">開く</span>
          </span>
        </summary>
        <div className="border-t border-zinc-100 px-2 pb-3 pt-1">
          <ProjectScheduleCalendar schedules={schedules} onSave={onSaveSchedule} saving={scheduleSaving} />
        </div>
      </details>
    </section>
  );
}
