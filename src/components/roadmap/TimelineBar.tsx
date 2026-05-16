"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { phaseBarLayout } from "@/lib/roadmap/timelineDates";
import type { ProjectStatus } from "@/lib/workspace/types";
import type { PhaseStatus as RoadmapPhaseStatus } from "@/lib/roadmap/types";

const statusBar: Record<string, string> = {
  backlog: "bg-zinc-400",
  planned: "bg-sky-500",
  in_progress: "bg-violet-500",
  paused: "bg-amber-400",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
};

export type TimelinePhaseLike = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus | RoadmapPhaseStatus | string;
  issues?: { status: string }[];
  tasks?: { status: string }[];
};

function phaseProgress(phase: TimelinePhaseLike): number {
  const items = phase.tasks ?? phase.issues ?? [];
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.status === "done").length;
  return Math.round((done / items.length) * 100);
}

export function TimelineBar({
  phase,
  anchor,
  pxPerDay,
  riskLate,
  canEdit = true,
  onResizeEnd,
  onClick,
}: {
  phase: TimelinePhaseLike;
  anchor: Date;
  pxPerDay: number;
  riskLate?: boolean;
  canEdit?: boolean;
  onResizeEnd: (phaseId: string, deltaDays: number) => void;
  onClick: () => void;
}) {
  const { left, width } = phaseBarLayout(phase.startDate, phase.endDate, anchor, pxPerDay);
  const progress = phaseProgress(phase);
  const dateLabel = `${phase.startDate.slice(0, 10)} → ${phase.endDate.slice(0, 10)}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: phase.id,
    disabled: !canEdit,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    left,
    width,
    opacity: isDragging ? 0.88 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  const [resizing, setResizing] = useState(false);
  const resizeStartX = useRef(0);
  const draggedRef = useRef(false);

  useEffect(() => {
    if (!resizing) return;
    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStartX.current;
      const days = Math.round(dx / pxPerDay);
      if (days !== 0) onResizeEnd(phase.id, days);
      setResizing(false);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [resizing, onResizeEnd, phase.id, pxPerDay]);

  const onResizeDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      resizeStartX.current = e.clientX;
      setResizing(true);
    },
    [canEdit],
  );

  const barColor = riskLate ? "bg-red-500 ring-2 ring-red-300" : statusBar[phase.status] ?? "bg-violet-500";

  return (
    <div className="relative h-11 border-b border-[#F7F8F8]">
      <div
        ref={setNodeRef}
        style={style}
        className={`absolute top-1 flex h-8 items-center overflow-hidden rounded-md text-xs font-semibold text-white shadow-sm ${barColor}`}
      >
        {canEdit ? (
          <button
            type="button"
            className="flex h-full w-6 shrink-0 cursor-grab touch-none items-center justify-center bg-black/15 active:cursor-grabbing"
            {...listeners}
            {...attributes}
            aria-label="ドラッグして移動"
            onPointerDown={() => {
              draggedRef.current = false;
            }}
            onPointerMove={() => {
              draggedRef.current = true;
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 opacity-90" />
          </button>
        ) : null}
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 truncate px-2 text-left hover:bg-black/10"
          onClick={(e) => {
            e.stopPropagation();
            if (!draggedRef.current) onClick();
            draggedRef.current = false;
          }}
          title={`${phase.title}（${dateLabel}）`}
        >
          <span className="truncate">{phase.title}</span>
          <span className="shrink-0 text-[10px] font-normal text-white/85">{progress}%</span>
        </button>
        {canEdit ? (
          <span
            className="flex h-full w-3 shrink-0 cursor-ew-resize items-stretch bg-white/30 hover:bg-white/45"
            onMouseDown={onResizeDown}
            aria-label="期間を調整"
            role="separator"
          />
        ) : null}
      </div>
    </div>
  );
}
