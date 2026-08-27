import { diffCalendarDaysFromTodayJapan, todayKeyJapan } from "@/lib/projects/teamActivityStreak";
import type { CalendarSchedule } from "@/components/projects/ProjectScheduleCalendar";
import { estimateCompletionDate, issueDoneRatio } from "@/lib/workspace/mapRows";
import type { Issue, IssueStatus, Phase, Project } from "@/lib/workspace/types";

export type ProgressHealth = "on_track" | "at_risk" | "behind" | "ahead" | "complete" | "empty";

export type IssueStatusCounts = Record<IssueStatus, number>;

export type PhaseProgressRow = {
  id: string;
  title: string;
  color: string;
  status: Phase["status"];
  total: number;
  done: number;
  pct: number;
  isActive: boolean;
  isPast: boolean;
  startDate: string;
  endDate: string;
};

export type ProjectProgressSummary = {
  donePct: number;
  doneCount: number;
  openCount: number;
  totalCount: number;
  counts: IssueStatusCounts;
  stackStatuses: IssueStatus[];
  velocityPerWeek: number;
  completedLast14Days: number;
  estimatedCompletion?: string;
  health: ProgressHealth;
  healthLabel: string;
  healthDetail: string;
  daysToTarget: number | null;
  targetDateLabel: string | null;
  overdueCount: number;
  dueSoonCount: number;
  urgentOpenCount: number;
  inProgressCount: number;
  phaseRows: PhaseProgressRow[];
  activePhaseId: string | null;
  upcomingSchedule: { title: string; startsAt: string } | null;
};

const STACK_ORDER: IssueStatus[] = ["in_progress", "in_review", "todo", "backlog", "done"];

const STACK_COLORS: Record<IssueStatus, string> = {
  backlog: "bg-zinc-300",
  todo: "bg-sky-400",
  in_progress: "bg-[#5E6AD2]",
  in_review: "bg-violet-400",
  done: "bg-emerald-500",
  cancelled: "bg-zinc-200",
};

export function statusBarColor(status: IssueStatus): string {
  return STACK_COLORS[status];
}

export function emptyIssueCounts(): IssueStatusCounts {
  return {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    cancelled: 0,
  };
}

function countByStatus(issues: Issue[]): IssueStatusCounts {
  const counts = emptyIssueCounts();
  for (const i of issues) counts[i.status] += 1;
  return counts;
}

function buildPhaseRows(phases: Phase[], todayKey: string): PhaseProgressRow[] {
  return [...phases]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const active = issuesInRange(p.startDate, p.endDate, todayKey);
      const start = p.startDate.slice(0, 10);
      const end = p.endDate.slice(0, 10);
      const total = p.issues.length;
      const done = p.issues.filter((i) => i.status === "done").length;
      return {
        id: p.id,
        title: p.title,
        color: p.color,
        status: p.status,
        total,
        done,
        pct: total === 0 ? 0 : Math.round((done / total) * 100),
        isActive: active,
        isPast: todayKey > end,
        startDate: start,
        endDate: end,
      };
    });
}

function issuesInRange(startDate: string, endDate: string, todayKey: string): boolean {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  return todayKey >= start && todayKey <= end;
}

function resolveHealth(input: {
  openCount: number;
  totalCount: number;
  daysToTarget: number | null;
  estimatedCompletion?: string;
  targetDate?: string;
  velocityPerWeek: number;
}): { health: ProgressHealth; healthLabel: string; healthDetail: string } {
  if (input.totalCount === 0) {
    return {
      health: "empty",
      healthLabel: "課題未登録",
      healthDetail: "課題を追加すると、完了率や予測がここに表示されます。",
    };
  }
  if (input.openCount === 0) {
    return {
      health: "complete",
      healthLabel: "すべて完了",
      healthDetail: "未完了の課題はありません。次のフェーズや新しい課題を検討できます。",
    };
  }

  const est = input.estimatedCompletion ? new Date(input.estimatedCompletion) : null;
  const target = input.targetDate ? new Date(input.targetDate) : null;
  const estLate = Boolean(est && target && est > target);

  if (estLate) {
    return {
      health: "at_risk",
      healthLabel: "遅延リスク",
      healthDetail: "直近の完了ペースだと、目標日より遅れて終わる見込みです。優先度の見直しを検討してください。",
    };
  }

  if (input.daysToTarget !== null && input.daysToTarget < 0) {
    return {
      health: "behind",
      healthLabel: "目標日超過",
      healthDetail: `目標日を ${Math.abs(input.daysToTarget)} 日過ぎています。残り ${input.openCount} 件の完了が必要です。`,
    };
  }

  if (input.daysToTarget !== null && input.daysToTarget <= 7 && input.velocityPerWeek < 1) {
    return {
      health: "behind",
      healthLabel: "ペース不足",
      healthDetail: "目標日が近いのに、ここ2週間の完了が少なめです。小さな課題から片付けると良いです。",
    };
  }

  if (input.velocityPerWeek >= 3 && input.openCount <= input.velocityPerWeek) {
    return {
      health: "ahead",
      healthLabel: "好調",
      healthDetail: "直近の完了ペースは良好です。このまま進めば目標に間に合いそうです。",
    };
  }

  return {
    health: "on_track",
    healthLabel: "順調",
    healthDetail: "現状のペースを維持できれば、大きな遅れなく進められそうです。",
  };
}

export function buildProjectProgressSummary(
  project: Project,
  issues: Issue[],
  phases: Phase[],
  schedules: CalendarSchedule[] = [],
): ProjectProgressSummary {
  const activeIssues = issues.filter((i) => i.status !== "cancelled");
  const counts = countByStatus(issues);
  const doneCount = counts.done;
  const openCount = activeIssues.filter((i) => i.status !== "done").length;
  const totalCount = activeIssues.length;
  const donePct = issueDoneRatio(activeIssues);

  const cutoff = Date.now() - 14 * 86400000;
  const completedLast14Days = issues.filter(
    (i) => i.status === "done" && new Date(i.updatedAt).getTime() >= cutoff,
  ).length;
  const velocityPerWeek = Math.round((completedLast14Days / 14) * 7 * 10) / 10;

  const estimatedCompletion = estimateCompletionDate(issues);
  const todayKey = todayKeyJapan();
  const daysToTarget = project.targetDate ? diffCalendarDaysFromTodayJapan(project.targetDate.slice(0, 10)) : null;

  const overdueCount = activeIssues.filter((i) => {
    if (i.status === "done" || !i.dueDate) return false;
    const d = diffCalendarDaysFromTodayJapan(i.dueDate.slice(0, 10));
    return d !== null && d < 0;
  }).length;

  const dueSoonCount = activeIssues.filter((i) => {
    if (i.status === "done" || !i.dueDate) return false;
    const d = diffCalendarDaysFromTodayJapan(i.dueDate.slice(0, 10));
    return d !== null && d >= 0 && d <= 3;
  }).length;

  const urgentOpenCount = activeIssues.filter(
    (i) => i.status !== "done" && (i.priority === "urgent" || i.priority === "high"),
  ).length;

  const inProgressCount = counts.in_progress + counts.in_review;

  const phaseRows = buildPhaseRows(phases, todayKey);
  const activePhaseId = phaseRows.find((p) => p.isActive)?.id ?? null;

  const nowMs = Date.now();
  const upcoming = schedules
    .filter((s) => new Date(s.starts_at).getTime() > nowMs)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

  const { health, healthLabel, healthDetail } = resolveHealth({
    openCount,
    totalCount,
    daysToTarget,
    estimatedCompletion,
    targetDate: project.targetDate,
    velocityPerWeek,
  });

  let targetDateLabel: string | null = null;
  if (project.targetDate) {
    if (daysToTarget === null) targetDateLabel = null;
    else if (daysToTarget === 0) targetDateLabel = "今日が目標日";
    else if (daysToTarget > 0) targetDateLabel = `あと ${daysToTarget} 日`;
    else targetDateLabel = `${Math.abs(daysToTarget)} 日超過`;
  }

  return {
    donePct,
    doneCount,
    openCount,
    totalCount,
    counts,
    stackStatuses: STACK_ORDER,
    velocityPerWeek,
    completedLast14Days,
    estimatedCompletion,
    health,
    healthLabel,
    healthDetail,
    daysToTarget,
    targetDateLabel,
    overdueCount,
    dueSoonCount,
    urgentOpenCount,
    inProgressCount,
    phaseRows,
    activePhaseId,
    upcomingSchedule: upcoming ? { title: upcoming.title, startsAt: upcoming.starts_at } : null,
  };
}

export const HEALTH_TONE: Record<ProgressHealth, string> = {
  on_track: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  ahead: "border-sky-200 bg-sky-50/80 text-sky-900",
  at_risk: "border-amber-200 bg-amber-50/80 text-amber-950",
  behind: "border-red-200 bg-red-50/80 text-red-900",
  complete: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  empty: "border-[#E5E7EB] bg-[#F7F8F8] text-[#374151]",
};
