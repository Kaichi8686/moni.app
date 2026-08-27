"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { IssueList } from "@/components/issues/IssueList";
import { KanbanBoard } from "@/components/issues/KanbanBoard";
import { IssueModal } from "@/components/issues/IssueModal";
import { useWorkspaceUiStore } from "@/lib/workspace/store";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
import type { Issue, IssueStatus, Priority } from "@/lib/workspace/types";
import { defaultWorkflowIfMissing } from "@/lib/workspace/issueWorkflow";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ISSUE_STATUS_OPTIONS: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];

export default function WorkspaceIssues() {
  const { tx } = useI18n();
  const issueStatusLabel: Record<IssueStatus, string> = {
    backlog: tx("あとで", "Later"),
    todo: tx("これから", "To do"),
    in_progress: tx("いまやってる", "In progress"),
    in_review: tx("確認中", "In review"),
    done: tx("完了", "Done"),
    cancelled: tx("やめた", "Cancelled"),
  };
  const {
    issues,
    project,
    projectId,
    phases,
    updateIssueStatus,
    createIssue,
    updateIssue,
    updateIssueWorkflow,
    completeIssue,
    canEdit,
  } = useProjectWorkspace();
  const createOpen = useWorkspaceUiStore((s) => s.createIssueOpen);
  const setCreateOpen = useWorkspaceUiStore((s) => s.setCreateIssueOpen);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "open" | "all">("open");
  const [showTip, setShowTip] = useState(true);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);
  const [toast, setToast] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftStatus, setDraftStatus] = useState<IssueStatus>("backlog");
  const [draftPriority, setDraftPriority] = useState<Priority>("medium");
  const [draftAssigneeId, setDraftAssigneeId] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [createErr, setCreateErr] = useState("");

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of project?.members ?? []) m[mem.id] = mem.name;
    return m;
  }, [project?.members]);

  const filteredIssues = useMemo(() => {
    if (statusFilter === "all") return issues;
    if (statusFilter === "open") {
      return issues.filter((i) => i.status !== "done" && i.status !== "cancelled");
    }
    return issues.filter((i) => i.status === statusFilter);
  }, [issues, statusFilter]);

  const sortedIssues = useMemo(() => sortIssuesByDueDate(filteredIssues), [filteredIssues]);

  const detailIssueLive = detailIssue ? issues.find((i) => i.id === detailIssue.id) ?? detailIssue : null;
  const editIssueLive = editIssue ? issues.find((i) => i.id === editIssue.id) ?? editIssue : null;
  const detailPhase = detailIssueLive?.phaseId ? phases.find((p) => p.id === detailIssueLive.phaseId) : undefined;

  function flashToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  async function toggleIssueDone(issue: Issue) {
    if (!canEdit) return;
    const next = issue.status === "done" ? "todo" : "done";
    await updateIssueStatus(issue.id, next);
    flashToast(next === "done" ? tx("完了しました", "Marked done") : tx("未完了に戻しました", "Marked incomplete"));
  }

  async function saveIssueMemo(issueId: string, memo: string) {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;
    const phase = issue.phaseId ? phases.find((p) => p.id === issue.phaseId) : undefined;
    const base = defaultWorkflowIfMissing(issue, phase?.title, phase?.description);
    await updateIssueWorkflow(issueId, { ...base, completionAnswer: memo.trim() });
  }

  function openCreate() {
    setCreateErr("");
    setDraftTitle("");
    setDraftDescription("");
    setDraftStatus("backlog");
    setDraftPriority("medium");
    setDraftAssigneeId("");
    setDraftDue("");
    setCreateOpen(true);
  }

  async function onCreateIssue(e: FormEvent) {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    setCreateErr("");
    try {
      await createIssue({
        title: draftTitle,
        description: draftDescription,
        status: draftStatus,
        priority: draftPriority,
        assigneeId: draftAssigneeId.trim() || null,
        dueDate: draftDue.trim() ? `${draftDue.trim()}T00:00:00.000Z` : null,
      });
      setDraftTitle("");
      setDraftDescription("");
      setDraftAssigneeId("");
      setDraftDue("");
      setCreateOpen(false);
    } catch (er) {
      setCreateErr(er instanceof Error ? er.message : tx("作成に失敗しました", "Couldn’t create"));
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("課題", "Issues")}</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">{tx("やることの一覧とカンバンです。", "A list and kanban of what to do.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button
              type="button"
              className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4F5BBD]"
              onClick={openCreate}
            >
              {tx("＋ 課題を追加", "+ Add issue")}
            </button>
          ) : null}
          <Link
            href={`/projects/${projectId}/coach`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#374151] hover:bg-[#F7F8F8]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {tx("相談AI", "Ask AI")}
          </Link>
        </div>
      </header>

      {showTip ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[12px] leading-relaxed text-[#4B5563]">
          <p>
            {tx("左側の丸をタップで即完了。くわしく進めたいときだけ詳細からガイドを開けます。", "Tap the circle to mark done. Open details only when you want the guide.")}
          </p>
          <button
            type="button"
            className="shrink-0 text-[11px] font-medium text-[#6B7280] hover:text-[#1A1A1A]"
            onClick={() => setShowTip(false)}
            aria-label={tx("ヒントを閉じる", "Dismiss tip")}
          >
            {tx("閉じる", "Close")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-[#E5E7EB] bg-white p-0.5">
          {(
            [
              { id: "list" as const, label: tx("リスト", "List") },
              { id: "kanban" as const, label: tx("カンバン", "Kanban") },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              className={`rounded px-3 py-1.5 text-[12px] font-semibold transition ${
                view === opt.id ? "bg-[#EEF0FF] text-[#5E6AD2]" : "text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IssueStatus | "open" | "all")}
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
          aria-label={tx("状態で絞り込み", "Filter by status")}
        >
          <option value="open">{tx("未完了のみ", "Open only")}</option>
          <option value="all">{tx("すべて", "All")}</option>
          {ISSUE_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {issueStatusLabel[s]}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-[#6B7280]">
          {view === "kanban"
            ? tx("列へドラッグで状態変更", "Drag to a column to change status")
            : tx("丸で完了 · 名前で詳細", "Circle to complete · name for details")}
          {" · "}
          {tx(`${sortedIssues.length}件`, `${sortedIssues.length}`)}
        </span>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          issues={sortedIssues}
          nameByUserId={names}
          onStatusChange={(id, s) => void updateIssueStatus(id, s)}
          onIssueOpen={(i) => setDetailIssue(i)}
        />
      ) : (
        <IssueList
          issues={sortedIssues}
          nameByUserId={names}
          canEdit={canEdit}
          onRowClick={(i) => setDetailIssue(i)}
          onToggleDone={(i) => void toggleIssueDone(i)}
        />
      )}

      {toast ? (
        <div
          className="pointer-events-none fixed bottom-[calc(var(--bottom-nav-clearance)+1rem)] left-1/2 z-[220] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <IssueDetailSheet
        issue={detailIssueLive}
        open={Boolean(detailIssueLive)}
        phaseTitle={detailPhase?.title}
        phaseGoal={detailPhase?.description}
        members={project?.members ?? []}
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
        onToggleDone={(i) => void toggleIssueDone(i)}
        onSaveWorkflow={async (id, workflow) => updateIssueWorkflow(id, workflow)}
        onMarkIssueDone={async (id, answer) => {
          await completeIssue(id, answer);
          flashToast(tx("完了しました", "Marked done"));
        }}
        onSaveMemo={(id, memo) => saveIssueMemo(id, memo)}
      />

      <IssueModal
        issue={editIssueLive}
        open={Boolean(editIssueLive)}
        onClose={() => setEditIssue(null)}
        members={project?.members ?? []}
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

      {createOpen && canEdit ? (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <form
            className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => void onCreateIssue(e)}
          >
            <h3 className="text-base font-semibold">{tx("課題を作成", "Create issue")}</h3>
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-title">
              {tx("タイトル", "Title")}
            </label>
            <input
              id="new-issue-title"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-[15px] text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
              placeholder={tx("例: まず3人に話を聞く", "e.g. Talk to 3 people first")}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <label className="mt-3 block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-desc">
              {tx("説明（任意）", "Description (optional)")}
            </label>
            <textarea
              id="new-issue-desc"
              className="mt-1 min-h-[6rem] w-full resize-y rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
              placeholder={tx("内容やメモを書けます", "Notes or details")}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-status">
                  {tx("ステータス", "Status")}
                </label>
                <select
                  id="new-issue-status"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as IssueStatus)}
                >
                  {ISSUE_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {issueStatusLabel[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-priority">
                  {tx("優先度", "Priority")}
                </label>
                <select
                  id="new-issue-priority"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value as Priority)}
                >
                  <option value="no_priority">{tx("なし", "None")}</option>
                  <option value="urgent">{tx("急", "Urgent")}</option>
                  <option value="high">{tx("高", "High")}</option>
                  <option value="medium">{tx("中", "Medium")}</option>
                  <option value="low">{tx("低", "Low")}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-assignee">
                  {tx("担当", "Assignee")}
                </label>
                <select
                  id="new-issue-assignee"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  value={draftAssigneeId}
                  onChange={(e) => setDraftAssigneeId(e.target.value)}
                >
                  <option value="">{tx("未割り当て", "Unassigned")}</option>
                  {(project?.members ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-medium text-[#6B7280]" htmlFor="new-issue-due">
                  {tx("期限（任意）", "Due date (optional)")}
                </label>
                <input
                  id="new-issue-due"
                  type="date"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  value={draftDue}
                  onChange={(e) => setDraftDue(e.target.value)}
                />
              </div>
            </div>
            {createErr ? <p className="mt-2 text-[13px] text-red-600">{createErr}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" onClick={() => setCreateOpen(false)}>
                {tx("キャンセル", "Cancel")}
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-sm font-semibold text-white">
                {tx("作成", "Create")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
