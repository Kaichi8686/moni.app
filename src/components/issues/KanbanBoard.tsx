"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Issue, IssueStatus } from "@/lib/workspace/types";
import { IssueCard } from "@/components/issues/IssueCard";

const cols: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];

const colLabel: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "進行中",
  in_review: "レビュー",
  done: "完了",
  cancelled: "中止",
};

function Col({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-w-[200px] flex-1 rounded-md border bg-[#F7F8F8] p-2 ${isOver ? "border-[#5E6AD2] ring-2 ring-[#5E6AD2]/20" : "border-[#E5E7EB]"}`}>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{title}</p>
      <div className="flex min-h-[120px] flex-col gap-2">{children}</div>
    </div>
  );
}

export function KanbanBoard({
  issues,
  nameByUserId,
  onStatusChange,
}: {
  issues: Issue[];
  nameByUserId: Record<string, string>;
  onStatusChange: (issueId: string, status: IssueStatus) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const overId = e.over?.id;
      const activeId = e.active?.id;
      if (!overId || !activeId) return;
      const s = String(overId).replace("col-", "") as IssueStatus;
      if (!cols.includes(s)) return;
      onStatusChange(String(activeId), s);
    },
    [onStatusChange],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map((c) => (
          <Col key={c} id={`col-${c}`} title={colLabel[c]}>
            {issues
              .filter((i) => (c === "backlog" ? i.status === "backlog" || i.status === "cancelled" : i.status === c))
              .map((i) => (
                <IssueCard key={i.id} issue={i} assigneeName={i.assigneeId ? nameByUserId[i.assigneeId] : undefined} />
              ))}
          </Col>
        ))}
      </div>
    </DndContext>
  );
}
