import { differenceInCalendarDays, parseISO } from "date-fns";
import type { IssueStatus } from "@/lib/workspace/types";

export type PhaseWindow = {
  id: string;
  order: number;
  startDate: string;
  endDate: string;
};

export type IssueDueSlot = {
  id: string;
  phaseId?: string;
  status: IssueStatus;
};

/** 日付キー（yyyy-MM-dd）を既存UIと同じ due_date 形式に */
export function dueIsoFromDateKey(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

function toDate(iso: string): Date {
  const d = parseISO(iso.length >= 10 ? iso.slice(0, 10) : iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampDay(d: Date, minDay: Date, maxDay: Date): Date {
  return new Date(Math.min(maxDay.getTime(), Math.max(minDay.getTime(), d.getTime())));
}

function availableDaysInWindow(windowStart: Date, windowEnd: Date, blocked?: Set<string>): Date[] {
  const start = startOfDayLocal(windowStart);
  const end = startOfDayLocal(windowEnd);
  if (end < start) return [start];
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = toDateKey(cur);
    if (!blocked?.has(key)) days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Spread due dates inside a window. Prefer days that are not in `blockedDateKeys`
 * (busy schedule days). If every day is blocked, fall back to the raw window.
 */
function spreadDueDatesInWindow(
  count: number,
  windowStart: Date,
  windowEnd: Date,
  blockedDateKeys?: Set<string>,
): string[] {
  if (count <= 0) return [];
  let days = availableDaysInWindow(windowStart, windowEnd, blockedDateKeys);
  if (days.length === 0) {
    days = availableDaysInWindow(windowStart, windowEnd, undefined);
  }
  if (days.length === 0) return [dueIsoFromDateKey(toDateKey(windowEnd))];
  if (count === 1) return [dueIsoFromDateKey(toDateKey(days[days.length - 1]))];

  const out: string[] = [];
  const last = days.length - 1;
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / Math.max(1, count - 1)) * last);
    out.push(dueIsoFromDateKey(toDateKey(days[idx])));
  }
  return out;
}

const OPEN_STATUSES = new Set<IssueStatus>(["backlog", "todo", "in_progress", "in_review"]);

/**
 * プロジェクトの完成日とフェーズ期間に沿って、未完了課題の期限を配分する。
 * blockedDateKeys がある日は期限を置かない。
 */
export function planIssueDueDates(input: {
  projectStart: string;
  projectTarget: string;
  phases: PhaseWindow[];
  issues: IssueDueSlot[];
  blockedDateKeys?: Set<string>;
}): Map<string, string> {
  const result = new Map<string, string>();
  const target = toDate(input.projectTarget);
  const start = toDate(input.projectStart);
  if (differenceInCalendarDays(target, start) < 0) return result;

  const sortedPhases = [...input.phases].sort((a, b) => a.order - b.order);
  const phaseById = new Map(sortedPhases.map((p) => [p.id, p]));
  const blocked = input.blockedDateKeys;

  const openIssues = input.issues.filter((i) => OPEN_STATUSES.has(i.status));
  const byPhase = new Map<string, IssueDueSlot[]>();
  const unphased: IssueDueSlot[] = [];

  for (const issue of openIssues) {
    if (issue.phaseId && phaseById.has(issue.phaseId)) {
      if (!byPhase.has(issue.phaseId)) byPhase.set(issue.phaseId, []);
      byPhase.get(issue.phaseId)!.push(issue);
    } else {
      unphased.push(issue);
    }
  }

  for (const phase of sortedPhases) {
    const list = byPhase.get(phase.id) ?? [];
    if (list.length === 0) continue;
    const phaseStart = clampDay(toDate(phase.startDate), start, target);
    const phaseEnd = clampDay(toDate(phase.endDate), phaseStart, target);
    const dues = spreadDueDatesInWindow(list.length, phaseStart, phaseEnd, blocked);
    list.forEach((issue, i) => {
      if (dues[i]) result.set(issue.id, dues[i]);
    });
  }

  if (unphased.length > 0) {
    const lastPhase = sortedPhases[sortedPhases.length - 1];
    const windowStart = lastPhase ? clampDay(toDate(lastPhase.startDate), start, target) : start;
    const dues = spreadDueDatesInWindow(unphased.length, windowStart, target, blocked);
    unphased.forEach((issue, i) => {
      if (dues[i]) result.set(issue.id, dues[i]);
    });
  }

  return result;
}

export type NewIssueDuePlanItem = {
  phaseId: string;
  indexInPhase: number;
  countInPhase: number;
};

/** 新規作成する課題（まだIDなし）向けに、フェーズ内の期限を1件計算 */
export function dueIsoForNewIssueInPhase(input: {
  projectStart: string;
  projectTarget: string;
  phaseStart: string;
  phaseEnd: string;
  indexInPhase: number;
  countInPhase: number;
  blockedDateKeys?: Set<string>;
}): string | null {
  if (input.countInPhase <= 0) return null;
  const target = toDate(input.projectTarget);
  const start = toDate(input.projectStart);
  const phaseStart = clampDay(toDate(input.phaseStart), start, target);
  const phaseEnd = clampDay(toDate(input.phaseEnd), phaseStart, target);
  const dues = spreadDueDatesInWindow(input.countInPhase, phaseStart, phaseEnd, input.blockedDateKeys);
  return dues[input.indexInPhase] ?? null;
}

export function hasMeaningfulTargetDate(targetDate?: string | null, startDate?: string | null): boolean {
  if (!targetDate?.trim()) return false;
  if (!startDate?.trim()) return true;
  return differenceInCalendarDays(toDate(targetDate), toDate(startDate)) >= 0;
}
