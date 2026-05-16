"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Issue } from "@/lib/workspace/types";
import { PriorityIcon } from "@/components/projects/PriorityIcon";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";

export function IssueCard({
  issue,
  assigneeName,
  onOpen,
}: {
  issue: Issue;
  assigneeName?: string;
  onOpen?: (issue: Issue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="rounded-md border border-[#E5E7EB] bg-white p-2.5 text-left shadow-sm"
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-manipulation rounded p-0.5 text-[#9CA3AF] hover:bg-zinc-100 hover:text-[#1A1A1A] active:cursor-grabbing"
          {...listeners}
          aria-label="ドラッグして列を移動"
          title="ここを掴んで列を移動"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpen?.(issue)}
        >
          <div className="flex items-start gap-2">
            <PriorityIcon priority={issue.priority} />
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[#1A1A1A]">{issue.title}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <IssueStatusBadge status={issue.status} />
            <Avatar name={assigneeName ?? "?"} url={undefined} />
          </div>
        </button>
      </div>
    </div>
  );
}
