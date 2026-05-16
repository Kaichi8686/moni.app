"use client";

import Link from "next/link";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  BlockedReasonCode,
  ProjectTaskMeta,
  TaskPriority,
  TaskStatus,
} from "@/lib/projects/types";
import { canViewTaskAnswer, mergeTaskMeta, parseTaskMeta, applyTaskMetaPatch, type TaskMetaPatch } from "@/lib/projects/taskMeta";
import { isTaskPastDue } from "@/lib/projects/taskDue";
import { ProjectScheduleCalendar, type CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";
import { normalizeTaskStatus, taskStatusLabelJa, toDbTaskStatus, type TaskWorkStatus } from "@/lib/projects/taskStatus";
import { applyTodaySlotOverrides, pickTodayThree, type TaskLikeForPick } from "@/lib/projects/todayThree";
import { suggestNextTaskTitles, type RoadmapStepRef } from "@/lib/projects/nextTaskSuggestions";
import type { CoachingContext } from "@/lib/projects/coachingContext";
import { BLOCKED_REASON_OPTIONS, blockedRestartHint } from "@/lib/projects/blockedHints";

export type TaskPanelRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string | null;
  roadmap_step_id: string | null;
  meta: unknown;
  updated_at: string;
};

type TaskFilter = "active" | "overdue" | "done" | "all";

const ESTIMATE_OPTIONS = [5, 15, 30, 60] as const;

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

function priorityLabel(p: TaskPriority): string {
  if (p === "high") return "高";
  if (p === "low") return "低";
  return "中";
}

function interactionMode(meta: ProjectTaskMeta): "choice" | "text" | "simple" {
  if (meta.inputKind === "choice" && meta.choiceOptions && meta.choiceOptions.length > 0) return "choice";
  if (meta.inputKind === "text") return "text";
  return "simple";
}

function isDueToday(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  const today = startOfDayLocal(new Date());
  const due = parseLocalDateKey(dueDateStr.slice(0, 10));
  return due.getTime() === today.getTime();
}

function isDueSoon(dueDateStr: string | null): boolean {
  if (!dueDateStr) return false;
  const today = startOfDayLocal(new Date());
  const due = parseLocalDateKey(dueDateStr.slice(0, 10));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diffDays > 0 && diffDays <= 7;
}

function taskRowToPick(t: TaskPanelRow): TaskLikeForPick {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    due_date: t.due_date,
    status: t.status,
    meta: t.meta,
    roadmap_step_id: t.roadmap_step_id,
    assignee_id: t.assignee_id,
  };
}

type Props = {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  coachingContext: CoachingContext;
  roadmapStepsBrief: RoadmapStepRef[];
  focusRoadmapStepId: string | null;
  nextMilestoneTitle: string | null;
  milestoneDoneCount: number;
  milestoneTotal: number;
  onSaveCoaching: (patch: Partial<CoachingContext>) => Promise<void>;
  onNavigateToChat?: () => void;
  tasks: TaskPanelRow[];
  uid: string | null;
  canEdit: boolean;
  memberNames: Record<string, string>;
  roadmapStepTitles?: Record<string, string>;
  onReload: () => void;
  onError: (msg: string) => void;
  schedules: CalendarSchedule[];
  scheduleSaving: boolean;
  onSaveSchedule: (payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    attendees: string;
  }) => Promise<void>;
};

export function ProjectTasksPanel({
  projectId,
  projectTitle,
  projectDescription,
  coachingContext,
  roadmapStepsBrief,
  focusRoadmapStepId,
  nextMilestoneTitle,
  milestoneDoneCount,
  milestoneTotal,
  onSaveCoaching,
  onNavigateToChat,
  tasks,
  uid,
  canEdit,
  memberNames,
  roadmapStepTitles = {},
  onReload,
  onError,
  schedules,
  scheduleSaving,
  onSaveSchedule,
}: Props) {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [choiceLocal, setChoiceLocal] = useState<Record<string, string>>({});
  const [textLocal, setTextLocal] = useState<Record<string, string>>({});
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("active");
  const [celebrateTask, setCelebrateTask] = useState<TaskPanelRow | null>(null);
  const [celebrateReflection, setCelebrateReflection] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardDream, setOnboardDream] = useState("");
  const [onboardStuck, setOnboardStuck] = useState("");
  const [onboardDeadline, setOnboardDeadline] = useState("");
  const [coachBusyId, setCoachBusyId] = useState<string | null>(null);

  const dreamHeadline = coachingContext.dreamStatement?.trim() || projectTitle;
  const dreamWhy = projectDescription?.trim() || coachingContext.stuckNow?.trim() || "";

  const runBusy = useCallback(
    async (taskId: string, fn: () => Promise<void>) => {
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
    },
    [onError, onReload],
  );

  const taskStats = useMemo(() => {
    const active = tasks.filter((t) => normalizeTaskStatus(t.status) !== "done");
    return {
      total: tasks.length,
      active: active.length,
      overdue: active.filter((t) => isTaskPastDue(t.due_date)).length,
      done: tasks.filter((t) => normalizeTaskStatus(t.status) === "done").length,
      blocked: tasks.filter((t) => normalizeTaskStatus(t.status) === "blocked").length,
      waiting: tasks.filter((t) => normalizeTaskStatus(t.status) === "waiting").length,
    };
  }, [tasks]);

  const doneTasks = useMemo(() => {
    const list = tasks.filter((t) => normalizeTaskStatus(t.status) === "done");
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [tasks]);

  const tasksPick = useMemo(() => tasks.map(taskRowToPick), [tasks]);

  const todayThree = useMemo(() => applyTodaySlotOverrides(pickTodayThree(tasksPick), tasksPick), [tasksPick]);

  const pinnedIds = useMemo(() => {
    const ids = new Set<string>();
    if (todayThree.important) ids.add(todayThree.important.id);
    if (todayThree.quick) ids.add(todayThree.quick.id);
    if (todayThree.consult) ids.add(todayThree.consult.id);
    return ids;
  }, [todayThree]);

  const celebrationSuggestions = useMemo(() => {
    if (!celebrateTask) return [];
    return suggestNextTaskTitles({
      completedTitle: celebrateTask.title,
      tasks: tasksPick,
      roadmapSteps: roadmapStepsBrief,
      focusStepId: focusRoadmapStepId,
    });
  }, [celebrateTask, tasksPick, roadmapStepsBrief, focusRoadmapStepId]);

  const activeBuckets = useMemo(() => {
    const active = tasks.filter((t) => normalizeTaskStatus(t.status) !== "done" && !pinnedIds.has(t.id));
    const overdue: TaskPanelRow[] = [];
    const today: TaskPanelRow[] = [];
    const soon: TaskPanelRow[] = [];
    const other: TaskPanelRow[] = [];
    for (const t of active) {
      if (isTaskPastDue(t.due_date)) overdue.push(t);
      else if (isDueToday(t.due_date)) today.push(t);
      else if (isDueSoon(t.due_date)) soon.push(t);
      else other.push(t);
    }
    const sortByDue = (a: TaskPanelRow, b: TaskPanelRow) => {
      const da = a.due_date ?? "\uffff";
      const db = b.due_date ?? "\uffff";
      if (da !== db) return da.localeCompare(db);
      return a.title.localeCompare(b.title, "ja");
    };
    overdue.sort(sortByDue);
    today.sort(sortByDue);
    soon.sort(sortByDue);
    other.sort(sortByDue);
    return { overdue, today, soon, other };
  }, [tasks, pinnedIds]);

  const showOnboardingCue = useMemo(() => {
    return canEdit && !coachingContext.onboardingDoneAt;
  }, [canEdit, coachingContext.onboardingDoneAt]);

  function canSubmitTask(task: TaskPanelRow): boolean {
    if (!canEdit || !uid) return false;
    if (isTaskPastDue(task.due_date)) return false;
    return true;
  }

  async function completeSimple(task: TaskPanelRow) {
    const client = supabase;
    if (!client || !canSubmitTask(task)) return;
    const snap = { ...task };
    setBusyIds((prev) => new Set(prev).add(task.id));
    try {
      const { error } = await client
        .from("project_tasks")
        .update({
          status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw new Error(error.message);
      await onReload();
      setCelebrateTask(snap);
      setCelebrateReflection("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function submitAnswer(task: TaskPanelRow, answer: string) {
    const client = supabase;
    if (!client || !canSubmitTask(task) || !answer.trim() || !uid) return;
    const meta = parseTaskMeta(task.meta);
    const next = mergeTaskMeta(meta, {
      answer: answer.trim(),
      answeredBy: uid,
      answeredAt: new Date().toISOString(),
    });
    const snap = { ...task };
    setBusyIds((prev) => new Set(prev).add(task.id));
    try {
      const { error } = await client
        .from("project_tasks")
        .update({
          meta: next,
          status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw new Error(error.message);
      await onReload();
      setCelebrateTask(snap);
      setCelebrateReflection("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  async function patchTaskStatus(task: TaskPanelRow, nextStatus: TaskWorkStatus, blockedCode?: BlockedReasonCode | null) {
    const client = supabase;
    if (!client) return;
    await runBusy(task.id, async () => {
      const patch: TaskMetaPatch =
        nextStatus === "blocked" && blockedCode
          ? { blockedReasonCode: blockedCode }
          : nextStatus !== "blocked"
            ? { blockedReasonCode: null }
            : {};
      const meta = applyTaskMetaPatch(task.meta, patch);
      const { error } = await client
        .from("project_tasks")
        .update({
          status: toDbTaskStatus(nextStatus),
          meta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw new Error(error.message);
    });
  }

  async function saveTaskCoachFields(task: TaskPanelRow, patch: TaskMetaPatch) {
    const client = supabase;
    if (!client || !canEdit) return;
    setCoachBusyId(task.id);
    try {
      const meta = applyTaskMetaPatch(task.meta, patch);
      const { error } = await client
        .from("project_tasks")
        .update({
          meta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw new Error(error.message);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setCoachBusyId(null);
    }
  }

  async function createTaskFromTitle(title: string, roadmapStepId: string | null) {
    const client = supabase;
    if (!client || !uid || !canEdit || !title.trim()) return;
    try {
      const { error } = await client.from("project_tasks").insert({
        project_id: projectId,
        title: title.trim(),
        description: "",
        status: "not_started",
        priority: "medium",
        due_date: null,
        assignee_id: uid,
        created_by: uid,
        ai_generated: false,
        roadmap_step_id: roadmapStepId,
        meta: { inputKind: "none", answerVisibility: "shared" },
      });
      if (error) throw new Error(error.message);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "追加に失敗しました。");
    }
  }

  async function closeCelebration(saveReflection: boolean) {
    const client = supabase;
    if (saveReflection && celebrateTask && celebrateReflection.trim() && client) {
      try {
        const meta = applyTaskMetaPatch(celebrateTask.meta, {
          lastReflection: celebrateReflection.trim(),
        });
        const { error } = await client.from("project_tasks").update({ meta, updated_at: new Date().toISOString() }).eq("id", celebrateTask.id);
        if (error) throw new Error(error.message);
        await onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "メモの保存に失敗しました。");
      }
    }
    setCelebrateTask(null);
    setCelebrateReflection("");
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
        status: "not_started",
        priority: "medium",
        due_date: draftDue.trim() || null,
        assignee_id: uid,
        created_by: uid,
        ai_generated: false,
        roadmap_step_id: focusRoadmapStepId,
        meta: { inputKind: "none", answerVisibility: "shared" },
      });
      setDraftDue("");
      if (error) {
        onError(error.message);
        return;
      }
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "タスクの追加に失敗しました。");
    }
  }

  function openOnboarding() {
    setOnboardDream(coachingContext.dreamStatement ?? "");
    setOnboardStuck(coachingContext.stuckNow ?? "");
    setOnboardDeadline(coachingContext.roughDeadline ?? "");
    setOnboardingOpen(true);
  }

  async function submitOnboarding(e: FormEvent) {
    e.preventDefault();
    try {
      await onSaveCoaching({
        dreamStatement: onboardDream.trim() || undefined,
        stuckNow: onboardStuck.trim() || undefined,
        roughDeadline: onboardDeadline.trim() || undefined,
        onboardingDoneAt: new Date().toISOString(),
      });
      setOnboardingOpen(false);
    } catch {
      /* onSaveCoaching handles errors via parent */
    }
  }

  async function skipOnboarding() {
    try {
      await onSaveCoaching({ onboardingDoneAt: new Date().toISOString() });
      setOnboardingOpen(false);
    } catch {
      /* parent */
    }
  }

  const filterChips: Array<{ key: TaskFilter; label: string }> = [
    { key: "active", label: "未完了" },
    { key: "overdue", label: "期限切れ" },
    { key: "done", label: "完了" },
    { key: "all", label: "すべて" },
  ];

  function renderTodayCard(label: string, hint: string, task: TaskLikeForPick | null, slot: "important" | "quick" | "consult") {
    return (
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">{label}</p>
        <p className="mt-0.5 text-[11px] text-indigo-900/80">{hint}</p>
        {task ? (
          <div className="mt-2 space-y-1">
            <p className="text-sm font-semibold leading-snug text-zinc-900">{task.title}</p>
            {task.roadmap_step_id && roadmapStepTitles[task.roadmap_step_id] ? (
              <p className="text-[10px] font-medium text-indigo-800">マイルストーン: {roadmapStepTitles[task.roadmap_step_id]}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-zinc-500">候補がありません。下の一覧から選ぶか、ひとこと追加してください。</p>
        )}
        {task && canEdit ? (
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold text-indigo-800 hover:underline"
            onClick={() => {
              const row = tasks.find((x) => x.id === task.id);
              if (row) void saveTaskCoachFields(row, { todaySlot: slot });
            }}
          >
            「今日の3つ」のこの枠に固定
          </button>
        ) : null}
      </div>
    );
  }

  function renderActiveTask(task: TaskPanelRow) {
    const meta = parseTaskMeta(task.meta);
    const mode = interactionMode(meta);
    const due = dueBadge(task.due_date);
    const border = leftBorderClass(due.tone, task.priority);
    const busy = busyIds.has(task.id);
    const pastDue = isTaskPastDue(task.due_date);
    const allowSubmit = canSubmitTask(task);
    const assigneeLabel = task.assignee_id ? memberNames[task.assignee_id] ?? "メンバー" : null;
    const roadmapLabel = task.roadmap_step_id ? roadmapStepTitles[task.roadmap_step_id] : null;
    const visibilityLabel =
      meta.answerVisibility === "private" ? "回答は投稿者のみ閲覧" : meta.answerVisibility === "shared" ? "回答は全員に共有" : null;

    const selectedChip = choiceLocal[task.id] ?? meta.answer ?? "";
    const textVal = textLocal[task.id] ?? "";
    const workSt = normalizeTaskStatus(task.status);
    const blockedHint = meta.blockedReasonCode ? blockedRestartHint(meta.blockedReasonCode) : null;

    return (
      <li
        key={task.id}
        className={`relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md ${border} ${pastDue ? "ring-1 ring-rose-200" : ""}`}
      >
        <div className="flex items-start gap-2 px-3 pb-1 pt-3">
          {mode === "simple" ? (
            <button
              type="button"
              disabled={!allowSubmit || busy || workSt === "blocked"}
              onClick={() => void completeSimple(task)}
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-[11px] font-bold text-zinc-500 transition hover:border-indigo-500 hover:text-indigo-700 disabled:opacity-40"
              aria-label={`${task.title}を完了にする`}
            >
              {busy ? "…" : ""}
            </button>
          ) : (
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800"
              aria-hidden
            >
              ?
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 break-words pr-1 text-[15px] font-bold leading-snug text-zinc-900">{task.title}</h3>
              {due.text ? (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badgeSurface(due.tone)}`}>{due.text}</span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-medium text-zinc-600">
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">{taskStatusLabelJa(workSt)}</span>
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">優先度 {priorityLabel(task.priority)}</span>
              {meta.estimatedMinutes ? (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">目安 {meta.estimatedMinutes}分</span>
              ) : null}
              {assigneeLabel ? <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">担当 {assigneeLabel}</span> : null}
              {task.due_date ? (
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">期限 {task.due_date.slice(0, 10).replace(/-/g, "/")}</span>
              ) : null}
              {roadmapLabel ? (
                <span className="max-w-full truncate rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-900">
                  マイルストーン: {roadmapLabel}
                </span>
              ) : (
                <span className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-zinc-400">マイルストーン未割当</span>
              )}
            </div>
            {canEdit ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-zinc-600">
                  状態
                  <select
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-900"
                    value={workSt}
                    disabled={busy}
                    onChange={(e) => {
                      const v = e.target.value as TaskWorkStatus;
                      if (v === "blocked") {
                        void patchTaskStatus(task, "blocked", "unknown_how");
                      } else {
                        void patchTaskStatus(task, v, null);
                      }
                    }}
                  >
                    <option value="not_started">これから</option>
                    <option value="in_progress">いま動いている</option>
                    <option value="blocked">いま詰まっている</option>
                    <option value="waiting">待ち</option>
                    <option value="done">完了</option>
                  </select>
                </label>
                {workSt === "blocked" ? (
                  <label className="flex flex-wrap items-center gap-1 text-[10px] font-semibold text-zinc-600">
                    理由
                    <select
                      className="max-w-[11rem] rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950"
                      value={meta.blockedReasonCode ?? ""}
                      disabled={busy}
                      onChange={(e) => {
                        const code = e.target.value as BlockedReasonCode | "";
                        if (!code) return;
                        void patchTaskStatus(task, "blocked", code);
                      }}
                    >
                      <option value="">選ぶとヒントが出ます</option>
                      {BLOCKED_REASON_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-3 border-t border-zinc-100 px-3 py-3">
          {meta.completionCriteria?.trim() ? (
            <p className="rounded-lg bg-zinc-50 px-2 py-1.5 text-[12px] text-zinc-700">
              <span className="font-semibold text-zinc-800">完了条件: </span>
              {meta.completionCriteria}
            </p>
          ) : null}
          {meta.whyThisMatters?.trim() ? (
            <p className="text-[12px] leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-800">この一歩の意味: </span>
              {meta.whyThisMatters}
            </p>
          ) : null}
          {workSt === "blocked" && blockedHint && meta.blockedReasonCode ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-[12px] text-amber-950">
              <p className="font-semibold">止まっているのは前提です。次の候補：</p>
              <p className="mt-1 leading-relaxed">{blockedHint.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {blockedHint.links.map((l) =>
                  l.href.startsWith("#") ? (
                    <a
                      key={l.label}
                      href={l.href}
                      className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900"
                    >
                      {l.label}
                    </Link>
                  ),
                )}
                {onNavigateToChat ? (
                  <button
                    type="button"
                    className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900"
                    onClick={onNavigateToChat}
                  >
                    プロジェクトのチャットへ
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {task.description.trim() ? (
            <p className="break-words text-[13px] leading-relaxed text-zinc-600">{task.description}</p>
          ) : null}
          {visibilityLabel && mode !== "simple" ? <p className="text-[10px] font-medium text-violet-800">{visibilityLabel}</p> : null}
          {pastDue ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
              期限を過ぎたため、回答・完了はできません。
            </p>
          ) : null}

          {canEdit ? (
            <details className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-zinc-800">伴走メモ（時間・意味・完了条件）</summary>
              <div className="mt-3 space-y-2 pb-1">
                <label className="block text-[11px] font-semibold text-zinc-700">
                  目安時間
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
                    value={meta.estimatedMinutes ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const patch: TaskMetaPatch =
                        raw === "" ? { estimatedMinutes: null } : { estimatedMinutes: Number(raw) as (typeof ESTIMATE_OPTIONS)[number] };
                      void saveTaskCoachFields(task, patch);
                    }}
                    disabled={coachBusyId === task.id}
                  >
                    <option value="">未設定</option>
                    {ESTIMATE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}分
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-zinc-700">
                  完了条件
                  <textarea
                    className="mt-1 min-h-[52px] w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
                    defaultValue={meta.completionCriteria ?? ""}
                    placeholder="何ができたら完了か、ひとことで"
                    disabled={coachBusyId === task.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (meta.completionCriteria ?? "").trim()) return;
                      void saveTaskCoachFields(task, { completionCriteria: v });
                    }}
                  />
                </label>
                <label className="block text-[11px] font-semibold text-zinc-700">
                  このタスクの意味
                  <textarea
                    className="mt-1 min-h-[52px] w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
                    defaultValue={meta.whyThisMatters ?? ""}
                    placeholder="なぜこれが効くか（任意）"
                    disabled={coachBusyId === task.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (meta.whyThisMatters ?? "").trim()) return;
                      void saveTaskCoachFields(task, { whyThisMatters: v });
                    }}
                  />
                </label>
                <label className="block text-[11px] font-semibold text-zinc-700">
                  相談のヒント（任意）
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm"
                    defaultValue={meta.consultHint ?? ""}
                    placeholder="誰に／何を聞くか"
                    disabled={coachBusyId === task.id}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (meta.consultHint ?? "").trim()) return;
                      void saveTaskCoachFields(task, { consultHint: v });
                    }}
                  />
                </label>
              </div>
            </details>
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
                      disabled={!allowSubmit || busy}
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
                disabled={!allowSubmit || busy || !selectedChip}
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
                disabled={!allowSubmit || busy}
                value={textVal}
                onChange={(e) => setTextLocal((prev) => ({ ...prev, [task.id]: e.target.value }))}
              />
              <button
                type="button"
                disabled={!allowSubmit || busy || !textVal.trim()}
                onClick={() => void submitAnswer(task, textVal)}
                className="mt-3 w-full rounded-xl border-2 border-zinc-200 bg-zinc-50/80 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-white disabled:opacity-40"
              >
                {busy ? "保存中…" : "回答する"}
              </button>
            </div>
          ) : null}

          {mode === "simple" && !pastDue ? (
            <button
              type="button"
              disabled={!allowSubmit || busy || workSt === "blocked"}
              onClick={() => void completeSimple(task)}
              className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy ? "保存中…" : "完了にする"}
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  function renderSection(title: string, hint: string, list: TaskPanelRow[]) {
    if (list.length === 0) return null;
    return (
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-900">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{hint}</p>
        <ul className="mt-3 space-y-3">{list.map(renderActiveTask)}</ul>
      </div>
    );
  }

  const showActiveSections = taskFilter === "active" || taskFilter === "all";
  const showOverdueOnly = taskFilter === "overdue";
  const showDone = taskFilter === "done" || taskFilter === "all";

  const onboardingIdeas = useMemo(() => {
    const d = onboardDream.trim() || projectTitle;
    const s = onboardStuck.trim() || "いまの不安や不明点";
    const dl = onboardDeadline.trim() || "ゴールの時期";
    return [
      `${dl}までに「${d}」へ近づくため、まず「${s}」を15分だけ言語化する`,
      `${d} のために必要な情報リストを3つ書き出す`,
      `${dl} を見ながら、ロードマップの最初のマイルストーンだけ決める`,
    ];
  }, [onboardDream, onboardStuck, onboardDeadline, projectTitle]);

  const weeklyBase = coachingContext.weeklyReview ?? {};

  return (
    <section id="schedule" className="mx-auto w-full max-w-lg space-y-5 pb-4">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/40 p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">夢ホーム</p>
        <h2 className="mt-1 text-lg font-bold leading-tight text-zinc-900">{dreamHeadline}</h2>
        {dreamWhy ? <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">{dreamWhy}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-white px-2.5 py-1 text-indigo-950 ring-1 ring-indigo-100">
            ここまで進みました{" "}
            {milestoneTotal > 0 ? `マイルストーン ${milestoneDoneCount}/${milestoneTotal}` : "（マイルストーン未作成）"}
          </span>
          {nextMilestoneTitle ? (
            <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-white">次のマイルストーン: {nextMilestoneTitle}</span>
          ) : null}
          {taskStats.blocked > 0 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 ring-1 ring-amber-100">
              いま詰まっている {taskStats.blocked}
            </span>
          ) : null}
          {taskStats.waiting > 0 ? (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-900 ring-1 ring-sky-100">待ち {taskStats.waiting}</span>
          ) : null}
        </div>
        {showOnboardingCue ? (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-white/90 px-3 py-2.5">
            <p className="text-[12px] font-semibold text-zinc-900">まずは3つだけ入力すると、伴走がしやすくなります</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white"
                onClick={() => openOnboarding()}
              >
                入力する
              </button>
              <button type="button" className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700" onClick={() => void skipOnboarding()}>
                あとで
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500">今日の3つ</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">いちばん大事な一つ・すぐ終わる一つ・相談／頼る一つ</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {renderTodayCard("いちばん大事な1つ", "今日はこれだけでも前進です", todayThree.important, "important")}
          {renderTodayCard("すぐ終わる1つ", "短時間で達成感をつくる", todayThree.quick, "quick")}
          {renderTodayCard("相談・頼る1つ", "一人で抱えない", todayThree.consult, "consult")}
        </div>
      </div>

      <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            今週のふりかえり（軽く）
            <span className="text-xs font-normal text-zinc-400">開く</span>
          </span>
        </summary>
        <div
          key={weeklyBase.updatedAt ?? "weekly-fields"}
          className="space-y-3 border-t border-zinc-100 px-4 py-3 text-[13px]"
        >
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-600">今週やったこと</span>
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              defaultValue={weeklyBase.done ?? ""}
              placeholder="一行でもOK"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (weeklyBase.done ?? "").trim()) return;
                void onSaveCoaching({
                  weeklyReview: {
                    ...weeklyBase,
                    done: v,
                    updatedAt: new Date().toISOString(),
                  },
                });
              }}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-600">学んだこと</span>
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              defaultValue={weeklyBase.learned ?? ""}
              placeholder="気づきや反省など"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (weeklyBase.learned ?? "").trim()) return;
                void onSaveCoaching({
                  weeklyReview: {
                    ...weeklyBase,
                    learned: v,
                    updatedAt: new Date().toISOString(),
                  },
                });
              }}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-zinc-600">来週やること</span>
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              defaultValue={weeklyBase.next ?? ""}
              placeholder="次の一歩だけでも"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === (weeklyBase.next ?? "").trim()) return;
                void onSaveCoaching({
                  weeklyReview: {
                    ...weeklyBase,
                    next: v,
                    updatedAt: new Date().toISOString(),
                  },
                });
              }}
            />
          </label>
        </div>
      </details>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold text-zinc-500">記録・完了ログ</p>
        <ul className="mt-2 space-y-2">
          {doneTasks.slice(0, 5).map((t) => {
            const m = parseTaskMeta(t.meta);
            const ref = m.lastReflection?.trim();
            return (
              <li key={t.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-[12px]">
                <p className="font-semibold text-zinc-800">{t.title}</p>
                {ref ? <p className="mt-1 text-zinc-600">学び・メモ: {ref}</p> : null}
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  {new Date(t.updated_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </li>
            );
          })}
          {doneTasks.length === 0 ? <li className="text-[13px] text-zinc-500">まだありません。ひとつ完了するとここに残ります。</li> : null}
        </ul>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold text-zinc-500">タスクの状況</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-800">未完了 {taskStats.active}</span>
          {taskStats.overdue > 0 ? (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-100">期限切れ {taskStats.overdue}</span>
          ) : null}
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">完了 {taskStats.done}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setTaskFilter(c.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              taskFilter === c.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {canEdit ? (
        <form
          onSubmit={(e) => void addQuickTask(e)}
          className="sticky top-0 z-[5] rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-md backdrop-blur-sm"
        >
          <p className="text-xs font-semibold text-zinc-700">タスクを追加</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">夢に直結する「次の一歩」を、動ける言い方で。</p>
          <div className="mt-2 flex flex-col gap-2">
            <input
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="やることをひとことで"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                value={draftDue}
                onChange={(e) => setDraftDue(e.target.value)}
                aria-label="期限"
              />
              <button
                type="submit"
                disabled={!draftTitle.trim()}
                className="shrink-0 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                追加
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {showOverdueOnly ? (
        activeBuckets.overdue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-10 text-center text-[13px] text-zinc-500">
            期限切れのタスクはありません。
          </p>
        ) : (
          renderSection("期限切れ", "優先して対応しましょう。", activeBuckets.overdue)
        )
      ) : null}

      {showActiveSections ? (
        <>
          {taskStats.active === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-10 text-center text-[13px] text-zinc-500">
              未完了のタスクはありません。ロードマップから一歩だけ置くか、上から追加してください。
            </p>
          ) : (
            <>
              {renderSection("期限切れ", "優先して対応しましょう。", activeBuckets.overdue)}
              {renderSection("今日やること", "今日が期限のタスクです。", activeBuckets.today)}
              {renderSection("期限が近い", "1週間以内に期限のタスクです。", activeBuckets.soon)}
              {renderSection("その他", "期限なし・先の予定のタスクです。", activeBuckets.other)}
            </>
          )}
        </>
      ) : null}

      {showDone ? (
        <div>
          <h2 className="text-[13px] font-bold text-zinc-400">完了済み</h2>
          <ul className="mt-3 space-y-2">
            {doneTasks.length === 0 ? (
              <li className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-400">まだありません</li>
            ) : null}
            {doneTasks.map((task) => {
              const meta = parseTaskMeta(task.meta);
              const canSee = canViewTaskAnswer(meta, uid, task.created_by);
              const line = canSee
                ? meta.answer?.trim() || task.description.trim() || "—"
                : meta.answer?.trim()
                  ? "回答済み（非公開）"
                  : task.description.trim() || "—";
              return (
                <li key={task.id} className="rounded-2xl border border-zinc-100 bg-zinc-100/60 px-3 py-3 opacity-75 shadow-sm">
                  <p className="break-words text-sm font-semibold text-zinc-400 line-through decoration-zinc-300">{task.title}</p>
                  <p className="mt-1 break-words text-[13px] font-medium text-zinc-500">{line}</p>
                  {meta.answerVisibility === "private" && canSee ? <p className="mt-1 text-[10px] text-zinc-400">非公開の回答</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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

      {onboardingOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-onboard-title"
        >
          <div className="max-h-[min(90dvh,640px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h2 id="coach-onboard-title" className="text-sm font-bold text-zinc-900">
                はじめの3つ
              </h2>
              <button type="button" className="rounded-full p-2 text-lg text-zinc-500 hover:bg-zinc-100" onClick={() => setOnboardingOpen(false)} aria-label="閉じる">
                ×
              </button>
            </div>
            <form className="space-y-4 px-4 py-4" onSubmit={(e) => void submitOnboarding(e)}>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-700">叶えたい夢・ゴール</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  value={onboardDream}
                  onChange={(e) => setOnboardDream(e.target.value)}
                  placeholder={projectTitle}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-700">いま困っていること・モヤモヤ</span>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  value={onboardStuck}
                  onChange={(e) => setOnboardStuck(e.target.value)}
                  placeholder="うまく言えなくてもOKです"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-700">いつ頃までに（ざっくり）</span>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  value={onboardDeadline}
                  onChange={(e) => setOnboardDeadline(e.target.value)}
                  placeholder="例: 夏まで / 3か月以内"
                />
              </label>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3">
                <p className="text-[11px] font-semibold text-indigo-900">叩き台（そのままタスクにしてもOK）</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-relaxed text-indigo-950">
                  {onboardingIdeas.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-700 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-800">
                保存してはじめる
              </button>
              <button type="button" className="w-full rounded-xl border border-zinc-200 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50" onClick={() => void skipOnboarding()}>
                入力せず閉じる
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {celebrateTask ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebrate-title"
        >
          <div className="max-h-[min(92dvh,680px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="border-b border-zinc-100 px-4 py-4">
              <h2 id="celebrate-title" className="text-base font-bold text-zinc-900">
                進みましたね
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                「{celebrateTask.title}」を完了にしました。ここまで来られたこと、そのものが前進です。
              </p>
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-zinc-600">学び・一言メモ（任意）</span>
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  value={celebrateReflection}
                  onChange={(e) => setCelebrateReflection(e.target.value)}
                  placeholder="気づきがあれば一行だけ"
                />
              </label>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">次に進む一歩（候補）</p>
              <ul className="space-y-2">
                {celebrationSuggestions.map((sug) => (
                  <li key={sug} className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[13px] font-medium text-zinc-800">{sug}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg bg-indigo-700 px-3 py-1.5 text-[11px] font-bold text-white"
                        onClick={() => void createTaskFromTitle(sug, focusRoadmapStepId)}
                      >
                        これをタスクにする
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white"
                  onClick={() => void closeCelebration(true)}
                >
                  メモを残して閉じる
                </button>
                <button type="button" className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-800" onClick={() => void closeCelebration(false)}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
