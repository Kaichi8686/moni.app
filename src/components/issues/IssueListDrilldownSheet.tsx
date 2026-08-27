"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Issue, Member } from "@/lib/workspace/types";
import { IssueList } from "@/components/issues/IssueList";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  issues: Issue[];
  members: Member[];
  onClose: () => void;
  onOpenIssue: (issue: Issue) => void;
};

export function IssueListDrilldownSheet({
  open,
  title,
  description,
  issues,
  members,
  onClose,
  onOpenIssue,
}: Props) {
  const { tx } = useI18n();
  if (!open || typeof document === "undefined") return null;

  const nameByUserId = Object.fromEntries(members.map((m) => [m.id, m.name]));

  return createPortal(
    <div className="fixed inset-0 z-[195] flex justify-end bg-black/25" role="presentation" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-lg flex-col border-l border-[#E5E7EB] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[#6B7280]">{description}</p> : null}
            <p className="mt-2 text-[12px] font-medium text-[#5E6AD2]">
              {tx(`${issues.length} 件 · 行をタップで詳細`, `${issues.length} · tap a row for details`)}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md p-2 text-[#6B7280] hover:bg-[#F7F8F8]"
            onClick={onClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {issues.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-4 py-8 text-center text-sm text-[#6B7280]">
              {tx("該当する課題はありません", "No matching issues")}
            </p>
          ) : (
            <IssueList issues={issues} nameByUserId={nameByUserId} onRowClick={onOpenIssue} />
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
