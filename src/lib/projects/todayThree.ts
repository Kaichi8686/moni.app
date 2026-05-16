import type { ProjectTaskMeta, TaskPriority, TodayThreeSlot } from "@/lib/projects/types";
import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import { parseTaskMeta } from "@/lib/projects/taskMeta";

export type { TodayThreeSlot };

export type TaskLikeForPick = {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  status: string;
  meta: unknown;
  roadmap_step_id: string | null;
  assignee_id?: string | null;
};

function estimateMinutes(meta: ProjectTaskMeta): number {
  const m = meta.estimatedMinutes;
  if (m === 5 || m === 15 || m === 30 || m === 60) return m;
  return 30;
}

function metaConsult(meta: ProjectTaskMeta): boolean {
  if (meta.todaySlot === "consult") return true;
  return /\u76f8\u8ac7|\u805e\u304f|\u983c\u3080|\u8cea\u554f/.test(meta.completionCriteria ?? "") ||
    /\u76f8\u8ac7|\u805e\u304f|\u983c\u3080|\u8cea\u554f/.test(meta.whyThisMatters ?? "") ||
    /\u76f8\u8ac7|\u805e\u304f|\u983c\u3080|\u8cea\u554f/.test(meta.consultHint ?? "");
}

/** 今日の3つ: いちばん重要 / すぐ終わる / 相談・頼る */
export function pickTodayThree(tasks: TaskLikeForPick[]): {
  important: TaskLikeForPick | null;
  quick: TaskLikeForPick | null;
  consult: TaskLikeForPick | null;
} {
  const pool = tasks.filter((t) => {
    const st = normalizeTaskStatus(t.status);
    return st !== "done" && st !== "waiting";
  });
  if (pool.length === 0) return { important: null, quick: null, consult: null };

  const priorityRank = (p: TaskPriority) => (p === "high" ? 0 : p === "medium" ? 1 : 2);

  const important = [...pool].sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    const da = a.due_date ?? "\uffff";
    const db = b.due_date ?? "\uffff";
    return da.localeCompare(db);
  })[0];

  const rest = pool.filter((t) => t.id !== important.id);

  const quick =
    [...rest].sort((a, b) => estimateMinutes(parseTaskMeta(a.meta)) - estimateMinutes(parseTaskMeta(b.meta)))[0] ??
    null;

  const consultMarked = rest.filter((t) => metaConsult(parseTaskMeta(t)));
  let consult: TaskLikeForPick | null =
    consultMarked.find((t) => t.id !== quick?.id) ?? consultMarked[0] ?? null;

  if (!consult && quick && rest.length > 1) {
    consult = rest.find((t) => t.id !== quick.id) ?? null;
  } else if (!consult && rest.length > 0) {
    consult = rest.find((t) => !t.assignee_id && t.id !== quick?.id) ?? rest[0];
  }

  return { important, quick, consult };
}

/** メタの todaySlot があればそのタスクを当該枠に固定 */
export function applyTodaySlotOverrides(
  base: ReturnType<typeof pickTodayThree>,
  tasks: TaskLikeForPick[],
): ReturnType<typeof pickTodayThree> {
  const pool = tasks.filter((t) => normalizeTaskStatus(t.status) !== "done");
  const bySlot = (slot: TodayThreeSlot) => pool.find((t) => parseTaskMeta(t.meta).todaySlot === slot) ?? null;

  return {
    important: bySlot("important") ?? base.important,
    quick: bySlot("quick") ?? base.quick,
    consult: bySlot("consult") ?? base.consult,
  };
}
