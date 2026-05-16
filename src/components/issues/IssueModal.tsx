"use client";

import type { Issue } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";

export function IssueModal({
  issue,
  open,
  onClose,
  assigneeName,
}: {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
  assigneeName?: string;
}) {
  if (!open || !issue) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/25" role="presentation" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md border-l border-[#E5E7EB] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <h2 className="text-base font-semibold">Issue</h2>
          <button type="button" className="rounded-md p-2 text-[#6B7280] hover:bg-[#F7F8F8]" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityIcon priority={issue.priority} />
            <IssueStatusBadge status={issue.status} />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A]">{issue.title}</h3>
          {issue.description ? <p className="text-sm text-[#6B7280]">{issue.description}</p> : null}
          <p className="text-[12px] text-[#6B7280]">担当: {assigneeName ?? "—"}</p>
        </div>
      </aside>
    </div>
  );
}
