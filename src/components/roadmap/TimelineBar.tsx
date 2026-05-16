"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import { differenceInCalendarDays } from "date-fns";
import type { Phase, ProjectStatus } from "@/lib/workspace/types";

const statusBar: Record<ProjectStatus, string> = {
  backlog: "bg-zinc-400",
  planned: "bg-sky-500",
  in_progress: "bg-[#5E6AD2]",
  paused: "bg-amber-400",
  completed: "bg-emerald-500",
  cancelled: "bg-red-400",
};

function phaseProgress(phase: Phase): number {
  const all = phase.issues.length;
  if (all === 0) return 0;
  const done = phase.issues.filter((i) => i.status === "done").length;
  return Math.round((done / all) * 100);
}

export function TimelineBar({
  phase,
  anchor,
  pxPerDay,
  riskLate,
  onResizeEnd,
  onClick,
}: {
  phase: Phase;
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
