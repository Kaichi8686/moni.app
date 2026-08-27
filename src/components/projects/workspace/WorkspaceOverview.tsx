"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { IssueListDrilldownSheet } from "@/components/issues/IssueListDrilldownSheet";
import { IssueModal } from "@/components/issues/IssueModal";
import { format } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { AlertCircle, ArrowRight, Calendar, CheckCircle2, Clock, Target, TrendingUp, Zap } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceOverviewQuickLinks } from "@/components/projects/workspace/WorkspaceOverviewQuickLinks";
import { ProjectStatusBadge } from "@/components/projects/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  buildProjectProgressSummary,
  HEALTH_TONE,
  statusBarColor,
  type IssueStatusCounts,
  type ProgressHealth,
} from "@/lib/workspace/progressSummary";
import {
  filterDueIssues,
  filterInProgressIssues,
} from "@/lib/workspace/issueFilters";
import type { Issue, IssueStatus } from "@/lib/workspace/types";

type KpiDrilldown = "in_progress" | "due" | null;

const HEALTH_EN: Record<ProgressHealth, { label: string; detail: string }> = {
  empty: {
    label: "No issues",
    detail: "Add issues to see completion rate and forecasts here.",
  },
  complete: {
    label: "All complete",
    detail: "No open issues. You can start the next phase or add new ones.",
  },
  at_risk: {
    label: "At risk",
    detail: "At the current pace, you’ll finish after the target date. Consider reviewing priorities.",
  },
  behind: {
    label: "Behind",
    detail: "You’re past the target date, or recent pace is too slow to finish on time.",
  },
  ahead: {
    label: "Ahead",
    detail: "Recent completion pace looks strong. You’re on track to hit the target.",
  },
  on_track: {
    label: "On track",
    detail: "If you keep this pace, you should stay on schedule.",
  },
};

function statusLabel(status: IssueStatus, tx: (ja: string, en: string) => string): string {
  const labels: Record<IssueStatus, [string, string]> = {
    backlog: ["あとで", "Later"],
    todo: ["これから", "To do"],
    in_progress: ["いまやってる", "In progress"],
    in_review: ["確認中", "In review"],
    done: ["完了", "Done"],
    cancelled: ["やめた", "Cancelled"],
  };
  const [jaLabel, enLabel] = labels[status];
  return tx(jaLabel, enLabel);
}

function IssueStatusStack({ counts, total }: { counts: IssueStatusCounts; total: number }) {
  const { tx } = useI18n();
  if (total === 0) {
    return <p className="text-[12px] text-[#6B7280]">{tx("課題がまだありません", "No issues yet")}</p>;
  }
  const segments = (
    [
      { status: "in_progress" as const, n: counts.in_progress },
      { status: "in_review" as const, n: counts.in_review },
      { status: "todo" as const, n: counts.todo },
      { status: "backlog" as const, n: counts.backlog },
      { status: "done" as const, n: counts.done },
    ] as const
  ).filter((s) => s.n > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
        {segments.map((s) => (
          <div
            key={s.status}
            className={`${statusBarColor(s.status)} transition-all duration-300`}
            style={{ width: `${(s.n / total) * 100}%` }}
            title={`${statusLabel(s.status, tx)} ${tx(`${s.n}件`, `${s.n}`)}`}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
        {segments.map((s) => (
          <li key={s.status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusBarColor(s.status)}`} aria-hidden />
            <span>
              {statusLabel(s.status, tx)} <span className="font-medium text-[#374151]">{s.n}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "ok";
  onClick?: () => void;
}) {
  const { tx } = useI18n();
  const toneClass =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/50"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50/40"
        : "border-[#E5E7EB] bg-[#FAFAFA]";
  const className = `w-full rounded-md border px-3 py-2.5 text-left transition ${toneClass} ${
    onClick ? "cursor-pointer hover:border-violet-300 hover:shadow-sm" : ""
  }`;
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[#6B7280]">
        {icon}
        <span className="text-xs font-semibold tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-base font-semibold tabular-nums text-[#1A1A1A]">{value}</p>
      {hint ? <p className="mt-0.5 text-sm leading-snug text-[#6B7280]">{hint}</p> : null}
      {onClick ? <p className="mt-1 text-xs font-medium text-violet-600">{tx("タップで一覧 →", "Tap for list →")}</p> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export default function WorkspaceOverview() {
  const { tx, locale } = useI18n();
  const {
    project,
    projectId,
    issues,
    phases,
    schedules,
    loading,
    canEdit,
    updateIssue,
    updateIssueStatus,
    updateIssueWorkflow,
    completeIssue,
  } = useProjectWorkspace();
  const [kpiDrilldown, setKpiDrilldown] = useState<KpiDrilldown>(null);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);

  const summary = useMemo(() => {
    if (!project) return null;
    return buildProjectProgressSummary(project, issues, phases, schedules);
  }, [project, issues, phases, schedules]);

  const drilldownIssues = useMemo(() => {
    if (kpiDrilldown === "in_progress") return filterInProgressIssues(issues);
    if (kpiDrilldown === "due") return filterDueIssues(issues);
    return [];
  }, [issues, kpiDrilldown]);

  const detailIssueLive = detailIssue ? issues.find((i) => i.id === detailIssue.id) ?? detailIssue : null;
  const editIssueLive = editIssue ? issues.find((i) => i.id === editIssue.id) ?? editIssue : null;
  const detailPhase = detailIssueLive?.phaseId
    ? phases.find((p) => p.id === detailIssueLive.phaseId)
    : undefined;
  const detailPhaseTitle = detailPhase?.title;
  const detailPhaseGoal = detailPhase?.description;

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project || !summary) return <p className="text-sm text-[#6B7280]">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const dateLocale = locale === "en" ? enUS : ja;
  const est = summary.estimatedCompletion ? new Date(summary.estimatedCompletion) : null;
  const target = project.targetDate ? new Date(project.targetDate) : null;
  const estLate = Boolean(est && target && est > target);
  const healthLabel = locale === "en" ? HEALTH_EN[summary.health].label : summary.healthLabel;
  const healthDetail = locale === "en" ? HEALTH_EN[summary.health].detail : summary.healthDetail;

  let targetValue = tx("未設定", "Not set");
  if (summary.daysToTarget !== null) {
    if (locale === "en") {
      if (summary.daysToTarget === 0) targetValue = "Target is today";
      else if (summary.daysToTarget > 0) targetValue = `${summary.daysToTarget} days left`;
      else targetValue = `${Math.abs(summary.daysToTarget)} days overdue`;
    } else {
      targetValue = summary.targetDateLabel ?? "未設定";
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("概要", "Overview")}</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {tx("進捗の全体像と、各画面へのショートカットです。", "Progress at a glance, plus shortcuts to each screen.")}
        </p>
      </header>

      <WorkspaceOverviewQuickLinks projectId={projectId} />

      <section className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F7F8F8] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#1A1A1A]">{tx("進捗サマリー", "Progress summary")}</h2>
          <div className="flex items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <Link
              href={`/projects/${projectId}/issues`}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#5E6AD2] hover:underline"
            >
              {tx("課題一覧", "All issues")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-[11px] font-medium text-[#6B7280]">{tx("課題の完了率", "Issue completion")}</p>
                <p className="mt-0.5 text-4xl font-semibold tabular-nums tracking-tight text-[#1A1A1A]">
                  {summary.donePct}
                  <span className="text-xl text-[#6B7280]">%</span>
                </p>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  <span className="font-medium text-[#374151]">{summary.doneCount}</span> / {summary.totalCount}{" "}
                  {tx("件完了", "done")}
                  {summary.openCount > 0 ? (
                    <span className="text-[#9CA3AF]">
                      {" "}
                      · {tx(`残り ${summary.openCount} 件`, `${summary.openCount} left`)}
                    </span>
                  ) : null}
                </p>
              </div>
              <ProgressBar value={summary.donePct} className="min-w-[140px] max-w-xs flex-1" />
            </div>

            <IssueStatusStack counts={summary.counts} total={summary.totalCount} />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={<Target className="h-3.5 w-3.5" />}
                label={tx("完成予定", "Target date")}
                value={targetValue}
                hint={
                  target
                    ? format(target, locale === "en" ? "MMM d, yyyy" : "yyyy年M月d日", { locale: dateLocale })
                    : tx("上の「完成したい日」から設定できます", "Set a target date from “Want to finish by” above")
                }
                tone={summary.daysToTarget !== null && summary.daysToTarget < 0 ? "warn" : "default"}
              />
              <KpiCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label={tx("完了ペース", "Pace")}
                value={tx(`${summary.velocityPerWeek} 件/週`, `${summary.velocityPerWeek} / week`)}
                hint={tx(
                  `直近14日で ${summary.completedLast14Days} 件完了`,
                  `${summary.completedLast14Days} done in the last 14 days`,
                )}
                tone={summary.velocityPerWeek >= 2 ? "ok" : "default"}
              />
              <KpiCard
                icon={<Zap className="h-3.5 w-3.5" />}
                label={tx("進行中", "In progress")}
                value={tx(`${summary.inProgressCount} 件`, `${summary.inProgressCount}`)}
                hint={
                  summary.urgentOpenCount > 0
                    ? tx(
                        `高優先度の未完了 ${summary.urgentOpenCount} 件`,
                        `${summary.urgentOpenCount} high-priority open`,
                      )
                    : tx("進行中 + レビュー中", "In progress + in review")
                }
                onClick={summary.inProgressCount > 0 ? () => setKpiDrilldown("in_progress") : undefined}
              />
              <KpiCard
                icon={<AlertCircle className="h-3.5 w-3.5" />}
                label={tx("期限", "Due")}
                value={
                  summary.overdueCount > 0
                    ? tx(`超過 ${summary.overdueCount} 件`, `${summary.overdueCount} overdue`)
                    : summary.dueSoonCount > 0
                      ? tx(`近日 ${summary.dueSoonCount} 件`, `${summary.dueSoonCount} due soon`)
                      : tx("問題なし", "On time")
                }
                hint={
                  summary.overdueCount > 0
                    ? tx("期限を過ぎた課題があります", "Some issues are past due")
                    : tx("3日以内の期限", "Due within 3 days")
                }
                tone={summary.overdueCount > 0 ? "warn" : summary.dueSoonCount > 0 ? "default" : "ok"}
                onClick={
                  summary.overdueCount + summary.dueSoonCount > 0 ? () => setKpiDrilldown("due") : undefined
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className={`rounded-md border px-3 py-3 ${HEALTH_TONE[summary.health]}`}>
              <div className="flex items-center gap-2">
                {summary.health === "complete" || summary.health === "ahead" || summary.health === "on_track" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 opacity-80" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 opacity-80" />
                )}
                <p className="text-[13px] font-semibold">{healthLabel}</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed opacity-90">{healthDetail}</p>
            </div>

            <div className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                <Clock className="h-3.5 w-3.5" />
                {tx("完了予測", "Forecast")}
              </p>
              <p className="mt-1.5 text-lg font-semibold tabular-nums text-[#1A1A1A]">
                {est
                  ? format(est, locale === "en" ? "EEE, MMM d" : "M月d日（E）", { locale: dateLocale })
                  : summary.openCount === 0
                    ? "—"
                    : tx("算出中", "Calculating")}
              </p>
              <p className={`mt-1 text-[11px] ${estLate ? "font-medium text-red-600" : "text-[#6B7280]"}`}>
                {summary.openCount === 0
                  ? tx("未完了の課題はありません", "No open issues")
                  : estLate
                    ? tx("目標日より遅い見込み", "Likely later than the target date")
                    : tx("直近2週間の完了ペースから推定", "Estimated from the last 2 weeks’ pace")}
              </p>
            </div>

            {summary.upcomingSchedule ? (
              <div className="rounded-md border border-[#E5E7EB] px-3 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  <Calendar className="h-3.5 w-3.5" />
                  {tx("次の予定", "Next event")}
                </p>
                <p className="mt-1 truncate text-[13px] font-medium text-[#1A1A1A]">{summary.upcomingSchedule.title}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                  {format(new Date(summary.upcomingSchedule.startsAt), locale === "en" ? "MMM d, HH:mm" : "M月d日 HH:mm", {
                    locale: dateLocale,
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <IssueListDrilldownSheet
        open={kpiDrilldown !== null}
        title={
          kpiDrilldown === "in_progress"
            ? tx("進行中の課題", "Issues in progress")
            : tx("期限が近い・超過の課題", "Due soon or overdue")
        }
        description={
          kpiDrilldown === "in_progress"
            ? tx("いま進めている課題の一覧です。", "Issues currently in progress or review.")
            : tx("期限超過と3日以内の課題です。", "Overdue issues and those due within 3 days.")
        }
        issues={drilldownIssues}
        members={project.members}
        onClose={() => setKpiDrilldown(null)}
        onOpenIssue={(issue) => {
          setKpiDrilldown(null);
          setDetailIssue(issue);
        }}
      />

      <IssueDetailSheet
        issue={detailIssueLive}
        open={Boolean(detailIssueLive)}
        phaseTitle={detailPhaseTitle}
        phaseGoal={detailPhaseGoal}
        members={project.members}
        canEdit={canEdit}
        onClose={() => setDetailIssue(null)}
        onEdit={
          canEdit && detailIssueLive
            ? () => {
                setEditIssue(detailIssueLive);
                setDetailIssue(null);
              }
            : undefined
        }
        onSaveWorkflow={async (id, workflow) => updateIssueWorkflow(id, workflow)}
        onMarkIssueDone={async (id, answer) => completeIssue(id, answer)}
        onToggleDone={async (issue) => {
          await updateIssueStatus(issue.id, issue.status === "done" ? "todo" : "done");
        }}
        onSaveMemo={async (id, memo) => {
          const issue = issues.find((i) => i.id === id);
          if (!issue) return;
          const phase = issue.phaseId ? phases.find((p) => p.id === issue.phaseId) : undefined;
          const { defaultWorkflowIfMissing } = await import("@/lib/workspace/issueWorkflow");
          const base = defaultWorkflowIfMissing(issue, phase?.title, phase?.description);
          await updateIssueWorkflow(id, { ...base, completionAnswer: memo.trim() });
        }}
      />

      <IssueModal
        issue={editIssueLive}
        open={Boolean(editIssueLive)}
        onClose={() => setEditIssue(null)}
        members={project.members}
        canEdit={canEdit}
        onSave={async (id, patch) => {
          await updateIssue(id, {
            title: patch.title,
            description: patch.description,
            priority: patch.priority,
            status: patch.status,
            assigneeId: patch.assigneeId,
            dueDate: patch.dueDate,
          });
        }}
      />
    </div>
  );
}
