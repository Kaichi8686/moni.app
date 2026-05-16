"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { addDays, differenceInCalendarDays } from "date-fns";
import type { Phase } from "@/lib/workspace/types";
import type { TimelineZoom } from "@/lib/workspace/types";
import { pxPerDay } from "@/lib/workspace/timelineLayout";
import { TimelineHeader } from "@/components/roadmap/TimelineHeader";
import { TimelineBar } from "@/components/roadmap/TimelineBar";

type Props = {
  phases: Phase[];
  onMovePhase: (phaseId: string, deltaDays: number) => void;
  onResizePhase: (phaseId: string, deltaDays: number) => void;
  onSelectPhase: (phase: Phase) => void;
};

export function RoadmapTimeline({ phases, onMovePhase, onResizePhase, onSelectPhase }: Props) {
  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [anchor, setAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const scrollRef = useRef<HTMLDivElement>(null);
  const ppd = pxPerDay(zoom);
  const totalDays = zoom === "week" ? 42 : zoom === "quarter" ? 360 : 120;
  const width = totalDays * ppd;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, delta } = e;
      if (!active?.id) return;
      const days = Math.round(delta.x / ppd);
      if (days !== 0) onMovePhase(String(active.id), days);
    },
    [onMovePhase, ppd],
  );

  const onPrev = () => setAnchor((a) => addDays(a, zoom === "week" ? -14 : -30));
  const onNext = () => setAnchor((a) => addDays(a, zoom === "week" ? 14 : 30));
  const onToday = () => {
    const t = new Date();
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    setAnchor(monthStart);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const off = differenceInCalendarDays(t, monthStart) * ppd;
      el.scrollTo({ left: Math.max(0, off - el.clientWidth / 2), behavior: "smooth" });
    });
  };

  const sorted = useMemo(() => [...phases].sort((a, b) => a.order - b.order), [phases]);

  return (
    <>
      <div className="space-y-2 rounded-md border border-[#E5E7EB] bg-white p-3 lg:hidden">
        <p className="text-[12px] font-semibold text-[#1A1A1A]">フェーズ一覧</p>
        <ul className="space-y-2 text-[13px] text-[#6B7280]">
          {sorted.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 border-b border-[#F7F8F8] pb-2">
              <span className="font-medium text-[#1A1A1A]">{p.title}</span>
              <span className="shrink-0 text-[11px]">
                {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden min-h-[420px] flex-col rounded-md border border-[#E5E7EB] bg-white lg:flex">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1">
          <div className="w-44 shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFA] pt-[5.25rem] text-[12px] font-medium text-[#6B7280]">
            {sorted.map((p) => (
              <div key={p.id} className="flex h-11 items-center border-b border-[#F7F8F8] px-3">
                <span className="truncate">{p.title}</span>
              </div>
            ))}
          </div>
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div style={{ width }}>
              <TimelineHeader
                anchor={anchor}
                totalDays={totalDays}
                zoom={zoom}
                onZoomChange={setZoom}
                onPrev={onPrev}
                onNext={onNext}
                onToday={onToday}
              />
              {sorted.map((p) => {
                const riskLate =
                  p.status !== "completed" && p.status !== "cancelled" && new Date(p.endDate).getTime() < Date.now();
                return (
                  <TimelineBar
                    key={p.id}
                    phase={p}
                    anchor={anchor}
                    pxPerDay={ppd}
                    riskLate={riskLate}
                    onResizeEnd={onResizePhase}
                    onClick={() => onSelectPhase(p)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>
      </div>
    </>
  );
}
