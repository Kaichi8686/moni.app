"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Issue, Priority } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";

const PRIORITIES: Priority[] = ["no_priority", "urgent", "high", "medium", "low"];
const priorityLabel: Record<Priority, string> = {
  no_priority: "なし",
  urgent: "急",
  high: "高",
  medium: "中",
  low: "低",
};

export function IssueModal({
  issue,
  open,
  onClose,
  assigneeName,
  canEdit,
  onSave,
}: {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  assigneeName?: string;
  canEdit: boolean;
  onSave: (issueId: string, patch: { title: string; description: string; priority: Priority }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!issue || !open) return;
    setTitle(issue.title);
    setDescription(issue.description ?? "");
    setPriority(issue.priority);
    setErr("");
  }, [issue, open]);

  if (!open || !issue) return null;

  const activeIssue = issue;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !title.trim()) return;
    setSaving(true);
    setErr("");
    try {
      await onSave(activeIssue.id, { title: title.trim(), description: description.trim(), priority });
      onClose();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "保存に失敗しました");
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
          <h2 className="text-base font-semibold">課題</h2>
          <button type="button" className="rounded-md p-2 text-[#6B7280] hover:bg-[#F7F8F8]" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        {canEdit ? (
          <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={(e) => void handleSubmit(e)}>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[12px] font-medium text-[#6B7280]">優先度</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[13px]"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel[p]}
                    </option>
                  ))}
                </select>
                <IssueStatusBadge status={activeIssue.status} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6B7280]" htmlFor="issue-edit-title">
                  タイトル
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
                  説明
                </label>
                <textarea
                  id="issue-edit-body"
                  className="mt-1 min-h-[10rem] w-full resize-y rounded-md border border-[#E5E7EB] px-3 py-2 text-sm leading-relaxed text-[#1A1A1A] outline-none ring-[#5E6AD2] focus:ring-2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="内容や受け入れ条件などを書けます"
                  rows={8}
                />
              </div>
              <p className="text-[12px] text-[#6B7280]">担当: {assigneeName ?? "—"}</p>
              {err ? <p className="text-[13px] text-red-600">{err}</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[#E5E7EB] bg-white px-4 py-3">
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" onClick={onClose} disabled={saving}>
                閉じる
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving}>
                {saving ? "保存中…" : "保存"}
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
            <p className="text-[12px] text-[#6B7280]">担当: {assigneeName ?? "—"}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
