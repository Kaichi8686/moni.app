"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { TaskPanelRow } from "@/components/projects/ProjectTasksPanel";
import { supabase } from "@/lib/supabase";
import type { ProjectMemberRow, ProjectRow } from "@/lib/projects/types";
import { normalizeTaskStatus, toDbTaskStatus } from "@/lib/projects/taskStatus";
import { buildRoadmapTemplateRows, businessTypeLabelJa, ROADMAP_TEMPLATES, roadmapTemplateKey } from "@/lib/projects/roadmapTemplates";
import { pickFocusStep, roadmapDonePercent, sortedRoadmapSteps } from "@/lib/projects/roadmapFocus";
import {
  STUDENT_ROADMAP_CATEGORIES,
  buildStudentRoadmapTemplateRows,
  type StudentRoadmapCategoryKey,
} from "@/lib/projects/studentRoadmapTemplates";
import { parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";
import { parseTaskMeta } from "@/lib/projects/taskMeta";
import type { BumpTeamActivityStreakResult } from "@/lib/projects/teamActivityStreak";
import { todayKeyJapan, diffCalendarDaysFromTodayJapan } from "@/lib/projects/teamActivityStreak";
import { countWeekCompletedTasksJapan } from "@/lib/projects/weekTaskStats";
import { burstCelebration } from "@/lib/ui/confetti";
import { maybeCelebrateStreakMilestone, maybeCelebrateWeeklyGoalReached } from "@/lib/ui/activityCelebration";

export type RoadmapStepFull = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  position: number;
  description: string | null;
  due_date: string | null;
  owner_id: string | null;
  notes: string | null;
  completion_criteria?: string | null;
};

type Props = {
  projectId: string;
  project: ProjectRow;
  uid: string | null;
  steps: RoadmapStepFull[];
  tasks: TaskPanelRow[];
  members: ProjectMemberRow[];
  memberNames: Record<string, string>;
  canEdit?: boolean;
  onSaveCoaching?: (patch: Partial<CoachingContext>) => Promise<void>;
  onRecordTeamActivity?: () => Promise<BumpTeamActivityStreakResult | null | void>;
  onReload: () => void;
  onError: (msg: string) => void;
};

function isStepOverdue(step: RoadmapStepFull): boolean {
  if (step.status === "done" || !step.due_date) return false;
  const d = diffCalendarDaysFromTodayJapan(step.due_date);
  return d != null && d < 0;
}

function statusBadge(step: RoadmapStepFull): { label: string; className: string } {
  if (step.status === "done") return { label: "完了", className: "bg-[#E8F5E9] text-emerald-900 ring-emerald-200/80" };
  if (step.status === "doing") return { label: "進行中", className: "bg-[#FFF3D6] text-orange-950 ring-orange-200/80" };
  if (isStepOverdue(step)) return { label: "期限切れ", className: "bg-rose-50 text-rose-800 ring-rose-100" };
  return { label: "未着手", className: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
}

function phaseGoalLine(step: RoadmapStepFull): string {
  const d = step.description?.trim();
  if (d) return d;
  const c = step.completion_criteria?.trim();
  if (c) return c;
  return `「${step.title}」で達成したいことを一文で書くと進みやすいです`;
}

function taskInteractionSimple(meta: unknown): boolean {
  const m = parseTaskMeta(meta);
  if (m.inputKind === "choice" && m.choiceOptions && m.choiceOptions.length > 0) return false;
  if (m.inputKind === "text") return false;
  return true;
}

function shouldCelebrate(): boolean {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition duration-200 ease-out focus:border-[#FF5C35] focus:ring-2 focus:ring-orange-100";

const STUCK_PRESETS = [
  "やることが多すぎてパニック",
  "モチベーションが落ちた",
  "次に何をすればいいかわからない",
  "チームと意見が合わない",
  "お金・コストが不安",
  "自由に話す",
] as const;

export function ProjectRoadmapPanel({
  projectId,
  project,
  uid,
  steps,
  tasks,
  members,
  memberNames,
  canEdit = false,
  onSaveCoaching,
  onRecordTeamActivity,
  onReload,
  onError,
}: Props) {
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<{
    title: string;
    description: string;
    status: RoadmapStepFull["status"];
    due_date: string;
    owner_id: string;
    notes: string;
    completion_criteria: string;
  } | null>(null);
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({});
  const [taskDueDraft, setTaskDueDraft] = useState<Record<string, string>>({});
  const [taskAssigneeDraft, setTaskAssigneeDraft] = useState<Record<string, string>>({});
  const [taskInputKindDraft, setTaskInputKindDraft] = useState<Record<string, "none" | "choice" | "text">>({});
  const [taskVisibilityDraft, setTaskVisibilityDraft] = useState<Record<string, "shared" | "private">>({});
  const [saving, setSaving] = useState(false);
  const [openStepMenuId, setOpenStepMenuId] = useState<string | null>(null);
  const [phaseGoalBusyId, setPhaseGoalBusyId] = useState<string | null>(null);
  const [phaseGoalPreview, setPhaseGoalPreview] = useState<{ stepId: string; text: string } | null>(null);
  const [stuckStepId, setStuckStepId] = useState<string | null>(null);
  const [stuckPreset, setStuckPreset] = useState<string | null>(null);
  const [stuckMessages, setStuckMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [stuckInput, setStuckInput] = useState("");
  const [stuckSending, setStuckSending] = useState(false);

  const orderedSteps = useMemo(() => sortedRoadmapSteps(steps), [steps]);
  const focusStep = useMemo(() => pickFocusStep(steps), [steps]);
  const coachingDream = useMemo(
    () => parseCoachingContext(project.coaching_context).dreamStatement ?? "",
    [project.coaching_context],
  );
  const focusIdx = useMemo(
    () => (focusStep ? orderedSteps.findIndex((s) => s.id === focusStep.id) : -1),
    [orderedSteps, focusStep],
  );
  const doneRate = useMemo(() => roadmapDonePercent(steps), [steps]);
  const tokyoDayRoll = todayKeyJapan();

  const activeSteps = useMemo(() => orderedSteps.filter((s) => s.status !== "done"), [orderedSteps]);
  const doneSteps = useMemo(() => orderedSteps.filter((s) => s.status === "done"), [orderedSteps]);

  const stepStats = useMemo(() => {
    void tokyoDayRoll;
    return {
      total: orderedSteps.length,
      todo: orderedSteps.filter((s) => s.status === "todo").length,
      doing: orderedSteps.filter((s) => s.status === "doing").length,
      done: orderedSteps.filter((s) => s.status === "done").length,
      overdue: orderedSteps.filter((s) => isStepOverdue(s)).length,
    };
  }, [orderedSteps, tokyoDayRoll]);

  const blockedCountByStep = useCallback(
    (stepId: string) =>
      tasks.filter((t) => t.roadmap_step_id === stepId && normalizeTaskStatus(t.status) === "blocked").length,
    [tasks],
  );

  const nextHintForStep = useCallback(
    (stepId: string): string | null => {
      const rel = tasks.filter((t) => t.roadmap_step_id === stepId);
      const blockedFirst = rel.find((t) => normalizeTaskStatus(t.status) === "blocked");
      if (blockedFirst) return `中断中のタスク: ${blockedFirst.title}`;
      const active = rel.find((t) => normalizeTaskStatus(t.status) !== "done");
      if (active) return `次のタスク: ${active.title}`;
      return null;
    },
    [tasks],
  );

  const tasksForStep = useCallback(
    (stepId: string) =>
      [...tasks.filter((t) => t.roadmap_step_id === stepId)].sort((a, b) =>
        a.updated_at < b.updated_at ? 1 : -1,
      ),
    [tasks],
  );

  const detailStep = useMemo(() => steps.find((s) => s.id === detailId) ?? null, [steps, detailId]);

  useEffect(() => {
    if (!detailStep) {
      setDetailDraft(null);
      return;
    }
    setDetailDraft({
      title: detailStep.title,
      description: detailStep.description ?? "",
      status: detailStep.status,
      due_date: detailStep.due_date ?? "",
      owner_id: detailStep.owner_id ?? "",
      notes: detailStep.notes ?? "",
      completion_criteria: detailStep.completion_criteria ?? "",
    });
  }, [detailStep]);

  useEffect(() => {
    if (!openStepMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-roadmap-step-menu-root]")) return;
      setOpenStepMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openStepMenuId]);

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "操作に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const seedStudentCategory = async (category: StudentRoadmapCategoryKey) => {
    if (steps.length > 0) {
      onError("すでにステップがあります。空にしてからテンプレートを選んでください。");
      return;
    }
    if (!supabase) {
      onError("接続設定が見つかりません。");
      return;
    }
    setSeeding(true);
    const rows = buildStudentRoadmapTemplateRows(projectId, category);
    const { error } = await supabase.from("project_roadmap_steps").insert(rows);
    setSeeding(false);
    if (error) {
      onError(error.message);
      return;
    }
    await onReload();
  };

  const seedFromTemplate = async () => {
    if (steps.length > 0) {
      onError("すでにステップがあります。空にしてからテンプレートを使うか、行を削除してください。");
      return;
    }
    if (!supabase) {
      onError("接続設定が見つかりません。");
      return;
    }
    setSeeding(true);
    const rows = buildRoadmapTemplateRows(projectId, project.business_type);
    const { error } = await supabase.from("project_roadmap_steps").insert(rows);
    setSeeding(false);
    if (error) {
      onError(error.message);
      return;
    }
    await onReload();
  };

  const addBlankStep = () =>
    run(async () => {
      if (!supabase || !uid) throw new Error("ログインが必要です。");
      const max = steps.reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await supabase.from("project_roadmap_steps").insert({
        project_id: projectId,
        title: "新しいステップ",
        status: "todo",
        position: max + 1,
        description: "",
        notes: "",
      });
      if (error) throw new Error(error.message);
    });

  const deleteStep = (id: string) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const { error } = await supabase.from("project_roadmap_steps").delete().eq("id", id);
      if (error) throw new Error(error.message);
      if (detailId === id) setDetailId(null);
      setOpenStepMenuId(null);
    });

  const moveStep = (stepId: string, dir: -1 | 1) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const list = sortedRoadmapSteps(steps);
      const i = list.findIndex((s) => s.id === stepId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      const a = list[i];
      const b = list[j];
      const { error: e1 } = await supabase.from("project_roadmap_steps").update({ position: b.position }).eq("id", a.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from("project_roadmap_steps").update({ position: a.position }).eq("id", b.id);
      if (e2) throw new Error(e2.message);
      setOpenStepMenuId(null);
    });

  const patchStep = (
    id: string,
    patch: Partial<Pick<RoadmapStepFull, "title" | "description" | "status" | "due_date" | "owner_id" | "notes" | "completion_criteria">>,
  ) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const prev = steps.find((s) => s.id === id)?.status;
      const { error } = await supabase
        .from("project_roadmap_steps")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      if (patch.status === "done" && prev !== "done") {
        const bump = (await Promise.resolve(onRecordTeamActivity?.())) ?? null;
        if (bump && "changed" in bump && bump.changed) maybeCelebrateStreakMilestone(bump.prevStreak, bump.newStreak);
      }
      if (patch.status === "done" && prev !== "done" && shouldCelebrate()) burstCelebration();
    });

  const toggleTaskCompleted = (task: TaskPanelRow) =>
    run(async () => {
      if (!supabase) throw new Error("接続がありません。");
      const st = normalizeTaskStatus(task.status);
      const next = st === "done" ? "not_started" : "done";
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: toDbTaskStatus(next), updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw new Error(error.message);
      if (next === "done") {
        const prevWeek = countWeekCompletedTasksJapan(tasks);
        const bump = (await Promise.resolve(onRecordTeamActivity?.())) ?? null;
        const goal = parseCoachingContext(project.coaching_context).weeklyCompletionGoal;
        maybeCelebrateWeeklyGoalReached(prevWeek, prevWeek + 1, goal);
        if (bump && "changed" in bump && bump.changed) maybeCelebrateStreakMilestone(bump.prevStreak, bump.newStreak);
      }
      if (next === "done" && shouldCelebrate()) burstCelebration();
    });

  const requestPhaseGoal = async (step: RoadmapStepFull) => {
    if (step.status === "done") return;
    setPhaseGoalBusyId(step.id);
    try {
      const r = await fetch("/api/projects/coach/phase-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phaseTitle: step.title,
          projectName: project.name,
          projectDescription: project.description ?? "",
          dreamStatement: coachingDream,
        }),
      });
      const j = (await r.json()) as { goal?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "提案に失敗しました");
      const goal = typeof j.goal === "string" ? j.goal.trim() : "";
      if (!goal) throw new Error("提案が空でした");
      setPhaseGoalPreview({ stepId: step.id, text: goal });
    } catch (e) {
      onError(e instanceof Error ? e.message : "AI提案に失敗しました");
    } finally {
      setPhaseGoalBusyId(null);
    }
  };

  const openStuckModal = (stepId: string) => {
    setStuckStepId(stepId);
    setStuckPreset(null);
    setStuckMessages([]);
    setStuckInput("");
  };

  const sendStuckTurn = async () => {
    if (!stuckStepId || stuckSending) return;
    const stepTitle = steps.find((s) => s.id === stuckStepId)?.title ?? "";
    const chunk = [stuckPreset ? `【${stuckPreset}】` : "", stuckInput.trim()].filter(Boolean).join("\n").trim();
    if (!chunk) {
      onError("上のテーマを選ぶか、メッセージを書いてから送ってください。");
      return;
    }
    const next = [...stuckMessages, { role: "user" as const, content: chunk }];
    setStuckMessages(next);
    setStuckInput("");
    setStuckSending(true);
    try {
      const r = await fetch("/api/projects/coach/stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          presetLabel: stuckPreset,
          projectName: project.name,
          focusPhaseTitle: stepTitle,
        }),
      });
      const j = (await r.json()) as { reply?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "送信に失敗しました");
      const reply = typeof j.reply === "string" ? j.reply.trim() : "";
      if (!reply) throw new Error("返答が空でした");
      setStuckMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      onError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setStuckSending(false);
    }
  };

  const applyPhaseGoalToStep = (stepId: string, text: string) => {
    void patchStep(stepId, { description: text });
    setPhaseGoalPreview(null);
  };

  const saveDetailDraft = () =>
    run(async () => {
      if (!supabase || !detailId || !detailDraft) return;
      const prev = detailStep?.status;
      const { error } = await supabase
        .from("project_roadmap_steps")
        .update({
          title: detailDraft.title.trim() || "無題",
          description: detailDraft.description,
          status: detailDraft.status,
          due_date: detailDraft.due_date || null,
          owner_id: detailDraft.owner_id || null,
          notes: detailDraft.notes,
          completion_criteria: detailDraft.completion_criteria.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", detailId);
      if (error) throw new Error(error.message);
      if (detailDraft.status === "done" && prev !== "done") {
        const bump = (await Promise.resolve(onRecordTeamActivity?.())) ?? null;
        if (bump && "changed" in bump && bump.changed) maybeCelebrateStreakMilestone(bump.prevStreak, bump.newStreak);
        if (shouldCelebrate()) burstCelebration();
      }
    });

  const addChildTask = (stepId: string) =>
    run(async () => {
      if (!supabase || !uid) throw new Error("ログインが必要です。");
      const title = (taskDraft[stepId] ?? "").trim();
      if (!title) return;
      const inputKind = taskInputKindDraft[stepId] ?? "none";
      const answerVisibility = taskVisibilityDraft[stepId] ?? "shared";
      const dueRaw = (taskDueDraft[stepId] ?? "").trim();
      const assignee = (taskAssigneeDraft[stepId] ?? "").trim() || null;
      const meta: Record<string, unknown> = { inputKind, answerVisibility };
      if (inputKind === "text") meta.placeholder = "回答を入力…";
      if (inputKind === "choice") meta.choiceOptions = ["はい", "いいえ", "わからない"];
      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        title,
        description: "",
        status: "not_started",
        priority: "medium",
        created_by: uid,
        assignee_id: assignee,
        due_date: dueRaw || null,
        roadmap_step_id: stepId,
        ai_generated: false,
        meta,
      });
      if (error) throw new Error(error.message);
      setTaskDraft((prev) => ({ ...prev, [stepId]: "" }));
      setTaskDueDraft((prev) => ({ ...prev, [stepId]: "" }));
    });

  function onAddStepSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !supabase || !uid) return;
    void run(async () => {
      const max = steps.reduce((m, s) => Math.max(m, s.position), 0);
      const { error } = await supabase!.from("project_roadmap_steps").insert({
        project_id: projectId,
        title: newTitle.trim(),
        status: "todo",
        position: max + 1,
        description: "",
        notes: "",
      });
      if (error) throw new Error(error.message);
      setNewTitle("");
    });
  }

  const scrollToStep = useCallback((stepId: string) => {
    document.getElementById(`roadmap-step-${stepId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const templateTitles = ROADMAP_TEMPLATES[roadmapTemplateKey(project.business_type)];

  const timelinePillLabel = (step: RoadmapStepFull, idx: number): string => {
    if (step.status === "done") return "完了";
    if (step.status === "doing") return "進行中";
    if (focusIdx >= 0 && idx === focusIdx) return "いまここ";
    if (focusIdx >= 0 && idx > focusIdx) return "これから";
    return "待機";
  };

  const coachingSnap = useMemo(() => parseCoachingContext(project.coaching_context), [project.coaching_context]);
  const weekTaskDoneCount = useMemo(() => {
    void tokyoDayRoll;
    return countWeekCompletedTasksJapan(tasks);
  }, [tasks, tokyoDayRoll]);

  return (
    <section className="space-y-4">
      <div
        className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200 ease-out"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">ロードマップ</p>
            <p className="mt-1 truncate text-sm font-bold text-[#1A1A1A]">{project.name}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
              ゴールまでの<span className="font-semibold text-zinc-800">フェーズ</span>
              をならべます。日々の作業は「タスク・予定」で細かく切っていきましょう。
            </p>
            <p className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-950 ring-1 ring-orange-100">
              {businessTypeLabelJa(project.business_type ?? null)}
            </p>
          </div>
          <div className="text-right">
            <p className="startup-font-mono text-2xl font-bold tabular-nums text-[#1A1A1A]">{doneRate}%</p>
            <p className="text-[11px] text-zinc-500">進み具合</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-[#FF5C35] transition-[width] duration-500 ease-out"
            style={{ width: `${doneRate}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium text-zinc-600">
          <span className="rounded-full bg-zinc-50 px-2.5 py-1 ring-1 ring-zinc-100">
            今週のタスク完了{" "}
            <span className="startup-font-mono text-zinc-900">{weekTaskDoneCount}</span>
            {coachingSnap.weeklyCompletionGoal != null ? (
              <>
                {" "}
                / 目標 <span className="startup-font-mono text-zinc-900">{coachingSnap.weeklyCompletionGoal}</span>
              </>
            ) : null}
            <span className="text-zinc-400">（月曜・東京）</span>
          </span>
          <span className="rounded-full bg-zinc-50 px-2.5 py-1 ring-1 ring-zinc-100">
            連続活動 <span className="startup-font-mono text-zinc-900">{coachingSnap.teamActivityStreak ?? 0}</span> 日
          </span>
        </div>
        {canEdit && onSaveCoaching ? (
          <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-2.5 py-2">
            <p className="text-[10px] font-semibold text-zinc-500">週の完了目標（ホーム・タスクと共通）</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[3, 5, 8, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={saving}
                  onClick={() => void onSaveCoaching({ weeklyCompletionGoal: n })}
                  className={`min-h-[30px] rounded-lg px-2.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                    coachingSnap.weeklyCompletionGoal === n
                      ? "bg-[#FF5C35] text-white shadow-sm"
                      : "border border-zinc-200 bg-white text-zinc-800 hover:bg-white"
                  }`}
                >
                  {n}件
                </button>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSaveCoaching({ weeklyCompletionGoal: 0 })}
                className="min-h-[30px] rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] font-semibold text-zinc-600 hover:bg-white disabled:opacity-50"
              >
                クリア
              </button>
            </div>
          </div>
        ) : null}
        {stepStats.total > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-[#FFF3D6] px-2.5 py-1 text-orange-950 ring-1 ring-orange-100">
              進行中 {stepStats.doing}
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700 ring-1 ring-zinc-200">未着手 {stepStats.todo}</span>
            <span className="rounded-full bg-[#E8F5E9] px-2.5 py-1 text-emerald-900 ring-1 ring-emerald-100">完了 {stepStats.done}</span>
            {stepStats.overdue > 0 ? (
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-100">要対応 {stepStats.overdue}</span>
            ) : null}
          </div>
        ) : null}
        {focusStep ? (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-[#FFF3D6]/90 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-orange-950">いま進めるフェーズ</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{focusStep.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-orange-950/85">
              {focusStep.status === "done"
                ? "このフェーズは完了です。次の未着手へ進みましょう。"
                : "下のチェックリストからひとつ進めると、次が見えやすくなります。"}
            </p>
          </div>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold text-[#1A1A1A]">どんなビジネス？</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-600">
            カテゴリを選ぶと、このプロジェクト向けのフェーズが自動で並びます（あとから名前も変えられます）。
          </p>
          <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
            {STUDENT_ROADMAP_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={seeding}
                onClick={() => void seedStudentCategory(c.key)}
                className="flex min-h-[44px] flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50/80 px-2 py-2.5 text-xs font-semibold text-zinc-900 shadow-sm transition duration-200 ease-out hover:bg-white disabled:opacity-50"
              >
                <span className="text-lg leading-none" aria-hidden>
                  {c.emoji}
                </span>
                <span className="mt-1 leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seedFromTemplate()}
              className="min-h-[44px] rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-800 shadow-sm transition duration-200 ease-out hover:bg-zinc-50 disabled:opacity-50"
            >
              {seeding ? "作成中…" : `${businessTypeLabelJa(project.business_type ?? null)}の例でも始める`}
            </button>
            <button
              type="button"
              onClick={() => void addBlankStep()}
              className="min-h-[44px] rounded-2xl border border-transparent bg-zinc-900 px-4 text-xs font-bold text-white shadow-sm transition duration-200 ease-out hover:bg-zinc-800"
            >
              空白から1フェーズ追加
            </button>
          </div>
          <p className="mt-4 text-left text-[11px] leading-relaxed text-zinc-500">
            系統テンプレの段階（{templateTitles.length}）: {templateTitles.join(" → ")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <p className="text-[11px] font-semibold text-zinc-500">タイムライン（横にスクロール）</p>
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 pt-0.5">
              {orderedSteps.map((step, idx) => {
                const label = timelinePillLabel(step, idx);
                const isDone = step.status === "done";
                const isDoing = step.status === "doing";
                const isFuture = focusIdx >= 0 && idx > focusIdx && !isDone;
                const dim = isDone || isFuture;
                return (
                  <div key={step.id} className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollToStep(step.id)}
                      className={`flex max-w-[8.5rem] flex-col rounded-2xl border px-2.5 py-2 text-left transition duration-200 ease-out ${
                        isDoing
                          ? "border-orange-300 bg-[#FFF3D6] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                          : isDone
                            ? "border-emerald-200/80 bg-[#E8F5E9]/80 opacity-90"
                            : isFuture
                              ? "border-zinc-100 bg-zinc-50/90 opacity-45"
                              : "border-zinc-200 bg-white"
                      } ${dim && !isDoing ? "grayscale-[0.35]" : ""}`}
                    >
                      <span className="text-[10px] font-bold leading-none text-zinc-500">
                        {isDoing ? "🔥 " : ""}
                        {label}
                      </span>
                      <span className={`mt-1 line-clamp-2 text-[11px] font-semibold leading-snug ${isDone ? "text-emerald-900" : "text-[#1A1A1A]"}`}>
                        {isDone ? "✓ " : ""}
                        {step.title}
                      </span>
                    </button>
                    {idx < orderedSteps.length - 1 ? (
                      <span className="shrink-0 px-0.5 text-xs font-medium text-zinc-300" aria-hidden>
                        →
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="space-y-4">
            {activeSteps.map((step) => {
              const n = orderedSteps.findIndex((s) => s.id === step.id) + 1;
              const idx = orderedSteps.findIndex((s) => s.id === step.id);
              const isFocus = focusStep?.id === step.id;
              const tc = tasksForStep(step.id).length;
              const blockedHere = blockedCountByStep(step.id);
              const nextHint = nextHintForStep(step.id);
              const badge = statusBadge(step);
              const isFutureRow = focusIdx >= 0 && idx > focusIdx && step.status !== "done";
              const goal = phaseGoalLine(step);
              const stepTasks = tasksForStep(step.id);

              let cardBg =
                step.status === "done"
                  ? "border-emerald-200/90 bg-[#E8F5E9]/70"
                  : step.status === "doing"
                    ? "border-orange-200 bg-[#FFF3D6]"
                    : isStepOverdue(step)
                      ? "border-rose-200 bg-rose-50/60"
                      : "border-zinc-200 bg-white";
              if (isFutureRow) cardBg = "border-zinc-100 bg-zinc-50/80 opacity-[0.72]";

              return (
                <li key={step.id} id={`roadmap-step-${step.id}`} className="scroll-mt-24">
                  <div
                    className={`relative rounded-2xl border p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition duration-200 ease-out ${cardBg} ${
                      isFocus && step.status !== "done" ? "ring-2 ring-[#FF5C35]/25" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {step.status === "doing" ? (
                            <span className="text-base leading-none" aria-hidden>
                              🔥
                            </span>
                          ) : null}
                          <h3 className="text-base font-bold text-[#1A1A1A]">{step.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.className}`}>{badge.label}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-700">&ldquo;{goal}&rdquo;</p>
                        {phaseGoalPreview?.stepId === step.id ? (
                          <div className="mt-2 rounded-2xl border border-orange-200 bg-[#FFF3D6]/95 px-3 py-2.5">
                            <p className="text-[11px] font-semibold text-orange-950">AIの一文ゴール案</p>
                            <p className="mt-1 text-sm leading-relaxed text-[#1A1A1A]">{phaseGoalPreview.text}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => applyPhaseGoalToStep(step.id, phaseGoalPreview.text)}
                                className="min-h-[40px] rounded-2xl bg-[#FF5C35] px-3 text-xs font-bold text-white transition duration-200 ease-out hover:brightness-105 disabled:opacity-50"
                              >
                                説明に反映する
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhaseGoalPreview(null)}
                                className="min-h-[40px] rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition duration-200 ease-out hover:bg-zinc-50"
                              >
                                閉じる
                              </button>
                            </div>
                          </div>
                        ) : step.status !== "done" ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving || phaseGoalBusyId === step.id}
                              onClick={() => void requestPhaseGoal(step)}
                              className="min-h-[40px] rounded-2xl border border-orange-200 bg-white px-3 text-[11px] font-semibold text-orange-950 shadow-sm transition duration-200 ease-out hover:bg-orange-50 disabled:opacity-50"
                            >
                              {phaseGoalBusyId === step.id ? "提案中…" : "✨ 一言ゴールをAI提案"}
                            </button>
                            <button
                              type="button"
                              disabled={saving || stuckSending}
                              onClick={() => openStuckModal(step.id)}
                              className="min-h-[40px] rounded-2xl border border-zinc-200 bg-white px-3 text-[11px] font-semibold text-zinc-800 shadow-sm transition duration-200 ease-out hover:bg-zinc-50 disabled:opacity-50"
                            >
                              🤔 詰まってる
                            </button>
                          </div>
                        ) : null}
                        {nextHint ? (
                          <p className="text-[11px] font-medium leading-snug text-orange-900/90">{nextHint}</p>
                        ) : step.notes?.trim() ? (
                          <p className="line-clamp-2 text-[11px] text-zinc-500">メモ: {step.notes}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-600">
                          {step.due_date ? (
                            <span className="rounded-2xl bg-white/90 px-2 py-1 ring-1 ring-zinc-200/90">
                              期限 {step.due_date}
                            </span>
                          ) : null}
                          {step.owner_id ? (
                            <span className="rounded-2xl bg-white/90 px-2 py-1 ring-1 ring-zinc-200/90">
                              担当 {memberNames[step.owner_id] ?? "メンバー"}
                            </span>
                          ) : null}
                          {tc > 0 ? (
                            <span className="rounded-2xl bg-white/90 px-2 py-1 ring-1 ring-zinc-200/90">やること {tc}件</span>
                          ) : null}
                          {blockedHere > 0 ? (
                            <span className="rounded-2xl bg-amber-50 px-2 py-1 font-semibold text-amber-900 ring-1 ring-amber-100">
                              中断 {blockedHere}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="ml-auto flex shrink-0 items-start gap-2">
                        <select
                          className="min-h-[44px] rounded-2xl border border-zinc-200 bg-white px-2 py-2 text-xs font-semibold text-zinc-800"
                          value={step.status}
                          onChange={(e) => void patchStep(step.id, { status: e.target.value as RoadmapStepFull["status"] })}
                          disabled={saving}
                          aria-label={`${step.title}の状態`}
                        >
                          <option value="todo">未着手</option>
                          <option value="doing">進行中</option>
                          <option value="done">完了</option>
                        </select>
                        <div className="relative" data-roadmap-step-menu-root>
                          <button
                            type="button"
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-lg font-bold text-zinc-500 transition duration-200 ease-out hover:bg-zinc-50"
                            aria-label={`${step.title}のその他`}
                            aria-expanded={openStepMenuId === step.id}
                            onClick={() => setOpenStepMenuId((id) => (id === step.id ? null : step.id))}
                          >
                            ⋯
                          </button>
                          {openStepMenuId === step.id ? (
                            <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-44 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl">
                              <button
                                type="button"
                                className="flex w-full px-3 py-2.5 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                                onClick={() => {
                                  setOpenStepMenuId(null);
                                  setDetailId(step.id);
                                }}
                              >
                                編集・詳細
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                className="flex w-full px-3 py-2.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                onClick={() => void moveStep(step.id, -1)}
                              >
                                上に移動
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                className="flex w-full px-3 py-2.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                                onClick={() => void moveStep(step.id, 1)}
                              >
                                下に移動
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                className="flex w-full px-3 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                onClick={() => {
                                  setOpenStepMenuId(null);
                                  if (typeof window !== "undefined" && !window.confirm("このフェーズを削除しますか？")) return;
                                  void deleteStep(step.id);
                                }}
                              >
                                削除
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {stepTasks.length > 0 ? (
                      <div className="mt-4 border-t border-zinc-200/70 pt-3">
                        <p className="text-[11px] font-semibold text-zinc-600">やること</p>
                        <ul className="mt-2 space-y-2">
                          {stepTasks.map((t) => {
                            const simple = taskInteractionSimple(t.meta);
                            const done = normalizeTaskStatus(t.status) === "done";
                            return (
                              <li key={t.id} className="flex items-start gap-2 rounded-xl bg-white/70 px-2 py-2 ring-1 ring-zinc-100">
                                {simple ? (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void toggleTaskCompleted(t)}
                                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-xs font-bold text-zinc-600 transition duration-200 ease-out hover:border-[#FF5C35] disabled:opacity-50"
                                    aria-label={done ? "未完了に戻す" : "完了にする"}
                                  >
                                    {done ? "✓" : ""}
                                  </button>
                                ) : (
                                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-xs text-zinc-400" title="タスク・予定タブで回答">
                                    ◇
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium leading-snug ${done ? "text-zinc-400 line-through" : "text-[#1A1A1A]"}`}>{t.title}</p>
                                  {!simple ? (
                                    <p className="mt-0.5 text-[10px] text-zinc-500">回答や選択があるタスクは「タスク・予定」で完了にしてください。</p>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200/60 pt-3">
                      <input
                        className={`min-h-[44px] min-w-[12rem] flex-1 ${inputClass}`}
                        placeholder="タスクを追加（例: 友達5人にアンケート）"
                        value={taskDraft[step.id] ?? ""}
                        onChange={(e) => setTaskDraft((prev) => ({ ...prev, [step.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={saving || !(taskDraft[step.id] ?? "").trim()}
                        onClick={() => void addChildTask(step.id)}
                        className="min-h-[44px] shrink-0 rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-800 transition duration-200 ease-out hover:bg-zinc-50 disabled:opacity-50"
                      >
                        追加
                      </button>
                      <button
                        type="button"
                        disabled={saving || step.status === "done"}
                        onClick={() => void patchStep(step.id, { status: "done" })}
                        className="min-h-[44px] shrink-0 rounded-2xl bg-[#FF5C35] px-4 text-xs font-bold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:opacity-40"
                      >
                        フェーズを完了
                      </button>
                    </div>

                    <p className="mt-2 text-[10px] text-zinc-400">フェーズ {n}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {doneSteps.length > 0 ? (
            <div className="mt-1">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left text-xs font-semibold text-zinc-700 transition duration-200 ease-out hover:bg-zinc-100"
                onClick={() => setDoneCollapsed((v) => !v)}
                aria-expanded={!doneCollapsed}
              >
                <span>完了済み（{doneSteps.length}）</span>
                <span aria-hidden>{doneCollapsed ? "▼" : "▲"}</span>
              </button>
              {!doneCollapsed ? (
                <ul className="relative mt-2 space-y-2">
                  {doneSteps.map((step) => {
                    const badge = statusBadge(step);
                    const n = orderedSteps.findIndex((s) => s.id === step.id) + 1;
                    return (
                      <li key={step.id}>
                        <button
                          type="button"
                          className="flex w-full min-h-[44px] items-center gap-3 rounded-2xl border border-emerald-100 bg-[#E8F5E9]/60 px-3 py-2.5 text-left transition duration-200 ease-out hover:bg-[#E8F5E9]"
                          onClick={() => setDetailId(step.id)}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                            ✓
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-emerald-950">{step.title}</span>
                            <span className="text-[10px] text-emerald-800/80">フェーズ {n}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.className}`}>{badge.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={onAddStepSubmit} className="flex gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <input
              className={inputClass}
              placeholder="＋ フェーズを追加（自由入力）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition duration-200 ease-out hover:bg-zinc-800 disabled:opacity-50"
              disabled={!newTitle.trim()}
            >
              追加
            </button>
          </form>
        </>
      )}

      {stuckStepId ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stuck-coach-title"
        >
          <div className="max-h-[min(92dvh,680px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h2 id="stuck-coach-title" className="text-sm font-bold text-[#1A1A1A]">
                詰まったとき相談
              </h2>
              <button
                type="button"
                className="rounded-full p-2 text-lg text-zinc-500 hover:bg-zinc-100"
                onClick={() => setStuckStepId(null)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-xs font-semibold text-zinc-600">どんな感じ？（タップで選択）</p>
              <div className="flex flex-wrap gap-2">
                {STUCK_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setStuckPreset(p)}
                    className={`min-h-[40px] rounded-2xl border px-3 py-2 text-left text-[11px] font-semibold transition duration-200 ease-out ${
                      stuckPreset === p
                        ? "border-[#FF5C35] bg-[#FFF3D6] text-[#1A1A1A]"
                        : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">続けて書く（任意）</span>
                <textarea
                  className={`mt-1 min-h-[4rem] ${inputClass}`}
                  value={stuckInput}
                  onChange={(e) => setStuckInput(e.target.value)}
                  placeholder="状況や気持ちをそのままどうぞ"
                  disabled={stuckSending}
                />
              </label>
              <button
                type="button"
                disabled={stuckSending}
                onClick={() => void sendStuckTurn()}
                className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#FF5C35] text-sm font-bold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:opacity-50"
              >
                {stuckSending ? "送信中…" : "相談する"}
              </button>
              {stuckMessages.length > 0 ? (
                <ul className="max-h-[240px] space-y-3 overflow-y-auto rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
                  {stuckMessages.map((m, i) => (
                    <li
                      key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                      className={`text-sm leading-relaxed ${m.role === "user" ? "text-right text-zinc-800" : "text-left text-zinc-700"}`}
                    >
                      <span className="text-[10px] font-semibold text-zinc-400">{m.role === "user" ? "あなた" : "コーチ"}</span>
                      <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {detailStep && detailDraft ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roadmap-detail-title"
        >
          <div className="max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
              <h2 id="roadmap-detail-title" className="text-sm font-bold text-zinc-900">
                フェーズを編集
              </h2>
              <button type="button" className="rounded-full p-2 text-lg text-zinc-500 hover:bg-zinc-100" onClick={() => setDetailId(null)} aria-label="閉じる">
                ×
              </button>
            </div>
            <div className="space-y-4 px-4 py-4">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">タイトル</span>
                <input
                  className={`mt-1 ${inputClass}`}
                  value={detailDraft.title}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">一言ゴール（説明）</span>
                <textarea
                  className={`mt-1 min-h-[5rem] ${inputClass}`}
                  value={detailDraft.description}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                  disabled={saving}
                  placeholder="チームで共有するゴールや成果物"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">完了条件（任意・詳しく）</span>
                <textarea
                  className={`mt-1 min-h-[3.5rem] ${inputClass}`}
                  value={detailDraft.completion_criteria}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, completion_criteria: e.target.value } : d))}
                  disabled={saving}
                  placeholder="例: ユーザー3人にヒアリングできた"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">状態</span>
                  <select
                    className={`mt-1 ${inputClass}`}
                    value={detailDraft.status}
                    onChange={(e) =>
                      setDetailDraft((d) =>
                        d ? { ...d, status: e.target.value as RoadmapStepFull["status"] } : d,
                      )
                    }
                    disabled={saving}
                  >
                    <option value="todo">未着手</option>
                    <option value="doing">進行中</option>
                    <option value="done">完了</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-600">期限</span>
                  <input
                    type="date"
                    className={`mt-1 ${inputClass}`}
                    value={detailDraft.due_date}
                    onChange={(e) => setDetailDraft((d) => (d ? { ...d, due_date: e.target.value } : d))}
                    disabled={saving}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">担当（1人）</span>
                <select
                  className={`mt-1 ${inputClass}`}
                  value={detailDraft.owner_id}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, owner_id: e.target.value } : d))}
                  disabled={saving}
                >
                  <option value="">未設定</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {memberNames[m.user_id] ?? m.user_id.slice(0, 8)}（{m.role}）
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600">メモ</span>
                <textarea
                  className={`mt-1 min-h-[4rem] ${inputClass}`}
                  value={detailDraft.notes}
                  onChange={(e) => setDetailDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                  disabled={saving}
                />
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDetailDraft()}
                className="min-h-[44px] w-full rounded-2xl bg-[#FF5C35] py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:brightness-105 disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>

              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
                <p className="text-xs font-semibold text-zinc-800">このフェーズのタスク</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">一覧やチェックはメイン画面でも操作できます。</p>
                <ul className="mt-2 space-y-1.5">
                  {tasks
                    .filter((t) => t.roadmap_step_id === detailStep.id)
                    .map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs">
                        <span className="min-w-0 truncate font-medium text-zinc-800">{t.title}</span>
                        <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{t.status}</span>
                      </li>
                    ))}
                  {tasks.filter((t) => t.roadmap_step_id === detailStep.id).length === 0 ? (
                    <li className="text-[11px] text-zinc-500">まだありません。閉じてからカード下で追加してください。</li>
                  ) : null}
                </ul>
                <div className="mt-3 space-y-2">
                  <input
                    className={inputClass}
                    placeholder="例: ワイヤーフレーム作成"
                    value={taskDraft[detailStep.id] ?? ""}
                    onChange={(e) => setTaskDraft((prev) => ({ ...prev, [detailStep.id]: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px]">
                      <span className="font-semibold text-zinc-600">期限</span>
                      <input
                        type="date"
                        className={`mt-0.5 ${inputClass}`}
                        value={taskDueDraft[detailStep.id] ?? ""}
                        onChange={(e) => setTaskDueDraft((prev) => ({ ...prev, [detailStep.id]: e.target.value }))}
                      />
                    </label>
                    <label className="block text-[11px]">
                      <span className="font-semibold text-zinc-600">担当</span>
                      <select
                        className={`mt-0.5 ${inputClass}`}
                        value={taskAssigneeDraft[detailStep.id] ?? ""}
                        onChange={(e) => setTaskAssigneeDraft((prev) => ({ ...prev, [detailStep.id]: e.target.value }))}
                      >
                        <option value="">未設定</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {memberNames[m.user_id] ?? m.user_id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px]">
                      <span className="font-semibold text-zinc-600">質問形式</span>
                      <select
                        className={`mt-0.5 ${inputClass}`}
                        value={taskInputKindDraft[detailStep.id] ?? "none"}
                        onChange={(e) =>
                          setTaskInputKindDraft((prev) => ({
                            ...prev,
                            [detailStep.id]: e.target.value as "none" | "choice" | "text",
                          }))
                        }
                      >
                        <option value="none">完了のみ</option>
                        <option value="choice">選択式</option>
                        <option value="text">自由記述</option>
                      </select>
                    </label>
                    <label className="block text-[11px]">
                      <span className="font-semibold text-zinc-600">回答の公開</span>
                      <select
                        className={`mt-0.5 ${inputClass}`}
                        value={taskVisibilityDraft[detailStep.id] ?? "shared"}
                        onChange={(e) =>
                          setTaskVisibilityDraft((prev) => ({
                            ...prev,
                            [detailStep.id]: e.target.value as "shared" | "private",
                          }))
                        }
                      >
                        <option value="shared">全員に共有</option>
                        <option value="private">投稿者のみ</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="min-h-[44px] w-full rounded-2xl bg-[#FF5C35] px-3 py-2 text-xs font-bold text-white transition duration-200 ease-out hover:brightness-105 disabled:opacity-50"
                    disabled={saving || !(taskDraft[detailStep.id] ?? "").trim()}
                    onClick={() => void addChildTask(detailStep.id)}
                  >
                    タスクを追加
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="min-h-[44px] w-full rounded-2xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 transition duration-200 ease-out hover:bg-zinc-50"
                onClick={() => setDetailId(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50 to-orange-50/30 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">つながる</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">コミュニティ・仲間探し</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">進捗を共有したり、質問したり、仮説を検証したりできます。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/?tab=posts&community=progress"
            className="min-h-[40px] rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition duration-200 ease-out hover:bg-zinc-50"
          >
            進捗共有
          </Link>
          <Link
            href="/?tab=posts&community=qna"
            className="min-h-[40px] rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition duration-200 ease-out hover:bg-zinc-50"
          >
            質問・相談
          </Link>
          <Link
            href="/?tab=chat"
            className="min-h-[40px] rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition duration-200 ease-out hover:bg-zinc-50"
          >
            探す
          </Link>
          <Link
            href="/?tab=mentor&mentor=validation"
            className="min-h-[40px] rounded-2xl border border-orange-200 bg-[#FFF3D6] px-3 py-2 text-xs font-semibold text-orange-950 shadow-sm transition duration-200 ease-out hover:bg-orange-100"
          >
            おためし検証
          </Link>
        </div>
      </div>
    </section>
  );
}
