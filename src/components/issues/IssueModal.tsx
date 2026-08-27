"use client";

import { FormEvent, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import type { Issue, IssueStatus, Member, Priority } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { useI18n } from "@/lib/i18n/I18nProvider";

const ISSUE_STATUSES: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
const PRIORITIES: Priority[] = ["no_priority", "urgent", "high", "medium", "low"];

function dueDateToInputValue(iso?: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export type IssueSavePatch = {
  title: string;
  description: string;
  priority: Priority;
  status: IssueStatus;
  assigneeId: string | null;
  dueDate: string | null;
};

export function IssueModal({
  issue,
  open,
  onClose,
  members,
  canEdit,
  onSave,
}: {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  members: Member[];
  canEdit: boolean;
  onSave: (issueId: string, patch: IssueSavePatch) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<IssueStatus>("todo");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueInput, setDueInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const { tx, locale } = useI18n();
  const priorityLabel: Record<Priority, string> = {
    no_priority: tx("なし", "None"),
    urgent: tx("急", "Urgent"),
    high: tx("高", "High"),
    medium: tx("中", "Medium"),
    low: tx("低", "Low"),
  };
  const statusLabel: Record<IssueStatus, string> = {
    backlog: tx("あとで", "Later"),
    todo: tx("これから", "To do"),
    in_progress: tx("いまやってる", "In progress"),
    in_review: tx("確認中", "In review"),
    done: tx("完了", "Done"),
    cancelled: tx("やめた", "Cancelled"),
  };

  useEffect(() => {
    if (!issue || !open) return;
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setPriority(issue.priority);
    setStatus(issue.status);
    setAssigneeId(issue.assigneeId ?? "");
    setDueInput(dueDateToInputValue(issue.dueDate));
    setErr("");
  }, [issue, open]);

  if (!open || !issue) return null;

  const activeIssue = issue;
  const assigneeName = activeIssue.assigneeId ? members.find((m) => m.id === activeIssue.assigneeId)?.name : undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !title.trim()) return;
    setSaving(true);
    setErr("");
    const dueDate = dueInput.trim() ? `${dueInput.trim()}T00:00:00.000Z` : null;
    const assignee = assigneeId.trim() || null;
    try {
      await onSave(activeIssue.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assigneeId: assignee,
        dueDate,
      });
      onClose();
    } catch (er) {
      setErr(er instanceof Error ? er.message : tx("保存に失敗しました", "Couldn’t save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[160] flex justify-end bg-black/25" role="presentation" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[#E5E7EB] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-base font-semibold">{tx("課題", "Issue")}</h2>
          <button type="button" className="rounded-md p-2 text-[#6B7280] hover:bg-[#F7F8F8]" onClick={onClose} aria-label={tx("閉じる", "Close")}>
            ×
          </button>
        </div>

        {canEdit ? (
          <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(e) => void handleSubmit(e)}>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-status">
                    {tx("ステータス", "Status")}
                  </label>
                  <select
                    id="issue-edit-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IssueStatus)}
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  >
                    {ISSUE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6B7280]">{tx("優先度", "Priority")}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {priorityLabel[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-assignee">
                    {tx("担当", "Assignee")}
                  </label>
                  <select
                    id="issue-edit-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  >
                    <option value="">{tx("未割り当て", "Unassigned")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-due">
                    {tx("期限", "Due date")}
                  </label>
                  <input
                    id="issue-edit-due"
                    type="date"
                    value={dueInput}
                    onChange={(e) => setDueInput(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-title">
                  {tx("タイトル", "Title")}
                </label>
                <input
                  id="issue-edit-title"
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-[15px] text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-body">
                  {tx("説明", "Description")}
                </label>
                <textarea
                  id="issue-edit-body"
                  className="mt-1 min-h-[10rem] w-full resize-y rounded-md border border-[#E5E7EB] px-3 py-2 text-sm leading-relaxed text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tx("内容や受け入れ条件などを書けます", "Details or acceptance criteria")}
                  rows={8}
                />
              </div>
              {err ? <p className="text-[13px] text-red-600">{err}</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[#E5E7EB] bg-white px-4 py-3">
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" onClick={onClose} disabled={saving}>
                {tx("閉じる", "Close")}
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving}>
                {saving ? tx("保存中…", "Saving…") : tx("保存", "Save")}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityIcon priority={activeIssue.priority} />
              <IssueStatusBadge status={activeIssue.status} />
            </div>
            <h3 className="text-lg font-semibold text-[#1A1A1A]">{activeIssue.title}</h3>
            {activeIssue.description ? <p className="whitespace-pre-wrap text-sm text-[#6B7280]">{activeIssue.description}</p> : null}
            <dl className="grid gap-1 text-[12px] text-[#6B7280]">
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-[#9CA3AF]">{tx("担当", "Assignee")}</dt>
                <dd>{assigneeName ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-[#9CA3AF]">{tx("期限", "Due")}</dt>
                <dd>
                  {activeIssue.dueDate
                    ? format(parseISO(activeIssue.dueDate), locale === "en" ? "MMM d, yyyy" : "yyyy/M/d", {
                        locale: locale === "en" ? enUS : ja,
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}
