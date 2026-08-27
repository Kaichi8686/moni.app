"use client";

import type { Issue } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { Avatar } from "@/components/ui/Avatar";
import { issueHasGuideActivity } from "@/lib/workspace/issueWorkflow";
import { format } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function IssueList({
  issues,
  nameByUserId,
  canEdit = false,
  onRowClick,
  onToggleDone,
}: {
  issues: Issue[];
  nameByUserId: Record<string, string>;
  canEdit?: boolean;
  onRowClick: (issue: Issue) => void;
  onToggleDone?: (issue: Issue) => void;
}) {
  const { tx, locale } = useI18n();
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#E5E7EB] bg-[#F7F8F8] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          <tr>
            <th className="w-10 px-2 py-2" aria-label={tx("完了", "Done")} />
            <th className="px-3 py-2">{tx("優先度", "Priority")}</th>
            <th className="px-3 py-2">{tx("タイトル", "Title")}</th>
            <th className="px-3 py-2">{tx("担当", "Assignee")}</th>
            <th className="px-3 py-2">{tx("ステータス", "Status")}</th>
            <th className="px-3 py-2">{tx("期限", "Due")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => {
            const done = i.status === "done";
            const guided = issueHasGuideActivity(i);
            return (
              <tr
                key={i.id}
                className="cursor-pointer border-b border-[#F7F8F8] transition-colors duration-150 hover:bg-[#F7F8F8]"
                onClick={() => onRowClick(i)}
              >
                <td className="px-2 py-2">
                  <button
                    type="button"
                    disabled={!canEdit || !onToggleDone}
                    aria-label={done ? tx("未完了に戻す", "Mark incomplete") : tx("完了にする", "Mark done")}
                    aria-pressed={done}
                    title={done ? tx("未完了に戻す", "Mark incomplete") : tx("タップで完了", "Tap to complete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone?.(i);
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition disabled:opacity-40 ${
                      done
                        ? "scale-100 border-emerald-500 bg-emerald-500 text-white"
                        : "border-[#D1D5DB] bg-white text-transparent hover:border-emerald-400"
                    }`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 transition ${done ? "opacity-100" : "opacity-0"}`}
                      strokeWidth={3}
                      aria-hidden
                    />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <PriorityIcon priority={i.priority} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={`font-medium ${done ? "text-[#9CA3AF] line-through" : "text-[#1A1A1A]"}`}
                    >
                      {i.title}
                    </span>
                    {guided ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                        {tx("ガイドあり", "Has guide")}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Avatar name={i.assigneeId ? nameByUserId[i.assigneeId] ?? "?" : "-"} url={undefined} />
                    <span className="text-[#6B7280]">{i.assigneeId ? nameByUserId[i.assigneeId] ?? "" : "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <IssueStatusBadge status={i.status} />
                </td>
                <td className="px-3 py-2 text-[#6B7280]">
                  {i.dueDate ? format(new Date(i.dueDate), "M/d", { locale: locale === "en" ? enUS : ja }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
