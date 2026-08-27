"use client";

import { useState } from "react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { IssueModal } from "@/components/issues/IssueModal";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
import type { Issue } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function WorkspaceSchedule() {
  const { tx } = useI18n();
  const {
    project,
    issues,
    phases,
    schedules,
    scheduleSaving,
    createSchedule,
    deleteSchedule,
    canEdit,
    updateIssue,
    updateIssueStatus,
    updateIssueWorkflow,
    completeIssue,
    loading,
  } = useProjectWorkspace();
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);

  const sortedIssues = sortIssuesByDueDate(issues);
  const detailIssueLive = detailIssue ? issues.find((i) => i.id === detailIssue.id) ?? detailIssue : null;
  const editIssueLive = editIssue ? issues.find((i) => i.id === editIssue.id) ?? editIssue : null;
  const detailPhase = detailIssueLive?.phaseId ? phases.find((p) => p.id === detailIssueLive.phaseId) : undefined;

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-[#6B7280]">{tx("プロジェクトがありません。", "No project found.")}</p>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("予定", "Schedule")}</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {tx("ミーティングやイベント、課題の期限をカレンダーで確認できます。", "Meetings, events, and issue due dates on a calendar.")}
        </p>
      </header>
      <ProjectScheduleCalendar
        schedules={schedules}
        issues={sortedIssues
          .filter((i) => i.dueDate)
          .map((i) => ({ id: i.id, title: i.title, dueDate: i.dueDate!, status: i.status }))}
        onIssueClick={(id) => {
          const issue = issues.find((x) => x.id === id);
          if (issue) setDetailIssue(issue);
        }}
        onSave={createSchedule}
        onDelete={deleteSchedule}
        saving={scheduleSaving}
        canEdit={canEdit}
      />
      <IssueDetailSheet
        issue={detailIssueLive}
        open={Boolean(detailIssueLive)}
        phaseTitle={detailPhase?.title}
        phaseGoal={detailPhase?.description}
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
