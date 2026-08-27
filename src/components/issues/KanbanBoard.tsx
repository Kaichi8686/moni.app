"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Issue, IssueStatus } from "@/lib/workspace/types";
import { IssueCard } from "@/components/issues/IssueCard";
import { useI18n } from "@/lib/i18n/I18nProvider";

const cols: IssueStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];

function Col({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[200px] flex-1 rounded-md border bg-[#F7F8F8] p-2 ${
        isOver ? "border-[#5E6AD2] ring-2 ring-[#5E6AD2]/20" : "border-[#E5E7EB]"
      }`}
    >
      <p className="mb-2 px-1 text-xs font-semibold text-[#6B7280]">{title}</p>
      <div className="flex min-h-[120px] flex-col gap-2">{children}</div>
    </div>
  );
}

export function KanbanBoard({
  issues,
  nameByUserId,
  onStatusChange,
  onIssueOpen,
}: {
  issues: Issue[];
  nameByUserId: Record<string, string>;
  onStatusChange: (issueId: string, status: IssueStatus) => void;
  onIssueOpen?: (issue: Issue) => void;
}) {
  const { tx } = useI18n();
  const colLabel: Record<IssueStatus, string> = {
    backlog: tx("あとで", "Later"),
    todo: tx("これから", "To do"),
    in_progress: tx("いまやってる", "In progress"),
    in_review: tx("確認中", "In review"),
    done: tx("完了", "Done"),
    cancelled: tx("やめた", "Cancelled"),
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [mobileCol, setMobileCol] = useState<IssueStatus>("todo");

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

  const mobileIssues = useMemo(
    () =>
      issues.filter((i) =>
        mobileCol === "backlog" ? i.status === "backlog" || i.status === "cancelled" : i.status === mobileCol,
      ),
    [issues, mobileCol],
  );

  return (
    <>
      {/* Mobile: single-column with status picker */}
      <div className="md:hidden">
        <label className="mb-2 block text-sm font-semibold text-[#374151]" htmlFor="kanban-status">
          {tx("表示する状態", "Status to show")}
        </label>
        <select
          id="kanban-status"
          className="mb-3 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-3 text-[15px] text-[#1A1A1A]"
          value={mobileCol}
          onChange={(e) => setMobileCol(e.target.value as IssueStatus)}
        >
          {cols.map((c) => (
            <option key={c} value={c}>
              {colLabel[c]}（
              {
                issues.filter((i) =>
                  c === "backlog" ? i.status === "backlog" || i.status === "cancelled" : i.status === c,
                ).length
              }
              ）
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-2">
          {mobileIssues.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#E5E7EB] px-4 py-8 text-center text-sm text-[#6B7280]">
              {tx("この状態の課題はまだありません", "No issues in this status")}
            </p>
          ) : (
            mobileIssues.map((i) => (
              <IssueCard
                key={i.id}
                issue={i}
                assigneeName={i.assigneeId ? nameByUserId[i.assigneeId] : undefined}
                onOpen={onIssueOpen}
              />
            ))
          )}
        </div>
      </div>

      {/* Desktop: multi-column board */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cols.map((c) => (
              <Col key={c} id={`col-${c}`} title={colLabel[c]}>
                {issues
                  .filter((i) => (c === "backlog" ? i.status === "backlog" || i.status === "cancelled" : i.status === c))
                  .map((i) => (
                    <IssueCard
                      key={i.id}
                      issue={i}
                      assigneeName={i.assigneeId ? nameByUserId[i.assigneeId] : undefined}
                      onOpen={onIssueOpen}
                    />
                  ))}
              </Col>
            ))}
          </div>
        </DndContext>
      </div>
    </>
  );
}
