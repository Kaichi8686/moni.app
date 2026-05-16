"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { differenceInCalendarDays } from "date-fns";
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
  onResizeEnd,
  onClick,
}: {
  phase: TimelinePhaseLike;
  anchor: Date;
  pxPerDay: number;
  riskLate?: boolean;
  onResizeEnd: (phaseId: string, deltaDays: number) => void;
  onClick: () => void;
}) {
  const start = new Date(phase.startDate);
  const end = new Date(phase.endDate);
  const left = differenceInCalendarDays(start, anchor) * pxPerDay;
  const width = Math.max(24, (differenceInCalendarDays(end, start) + 1) * pxPerDay);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: phase.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    left,
    width,
    opacity: isDragging ? 0.88 : 1,
  };

  const [resizing, setResizing] = useState(false);
  const resizeStartX = useRef(0);

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
      e.preventDefault();
      e.stopPropagation();
      resizeStartX.current = e.clientX;
      setResizing(true);
    },
    [],
  );

  const barColor = riskLate ? "bg-red-500" : statusBar[phase.status] ?? "bg-[#5E6AD2]";

  return (
    <div className="relative h-11 border-b border-[#F7F8F8]">
      <div
        ref={setNodeRef}
        style={style}
        className={`absolute top-1 flex h-8 cursor-grab items-center overflow-hidden rounded-md text-xs font-semibold text-white shadow-sm active:cursor-grabbing ${barColor}`}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center truncate px-2 text-left"
          {...listeners}
          {...attributes}
          onClick={() => onClick()}
          title={`${phase.title} (${phase.startDate.slice(0, 10)} → ${phase.endDate.slice(0, 10)})`}
        >
          {phase.title} · {phaseProgress(phase)}%
        </button>
        <span
          className="flex h-full w-2 shrink-0 cursor-ew-resize items-stretch bg-white/25 hover:bg-white/40"
          onMouseDown={onResizeDown}
          aria-label="期間を調整"
          role="separator"
        />
      </div>
    </div>
  );
}
