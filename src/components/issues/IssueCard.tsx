"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Issue } from "@/lib/workspace/types";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";

export function IssueCard({ issue, assigneeName }: { issue: Issue; assigneeName?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-[#E5E7EB] bg-white p-2.5 text-left shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <PriorityIcon priority={issue.priority} />
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[#1A1A1A]">{issue.title}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <IssueStatusBadge status={issue.status} />
        <Avatar name={assigneeName ?? "?"} url={undefined} />
      </div>
    </div>
  );
}
