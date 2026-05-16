"use client";

import type { Issue } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { Avatar } from "@/components/ui/Avatar";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export function IssueList({
  issues,
  nameByUserId,
  onRowClick,
}: {
  issues: Issue[];
  nameByUserId: Record<string, string>;
  onRowClick: (issue: Issue) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E7EB] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-[#E5E7EB] bg-[#F7F8F8] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          <tr>
            <th className="px-3 py-2">優先度</th>
            <th className="px-3 py-2">タイトル</th>
            <th className="px-3 py-2">担当</th>
            <th className="px-3 py-2">ステータス</th>
            <th className="px-3 py-2">期限</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr
              key={i.id}
              className="cursor-pointer border-b border-[#F7F8F8] transition-colors duration-150 hover:bg-[#F7F8F8]"
              onClick={() => onRowClick(i)}
            >
              <td className="px-3 py-2">
                <PriorityIcon priority={i.priority} />
              </td>
              <td className="px-3 py-2 font-medium text-[#1A1A1A]">{i.title}</td>
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
                {i.dueDate ? format(new Date(i.dueDate), "M/d", { locale: ja }) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
