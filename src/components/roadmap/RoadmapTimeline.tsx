"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { addDays, differenceInCalendarDays, startOfMonth } from "date-fns";
import type { RoadmapPhaseWithIssues } from "@/lib/roadmap/mergeWithIssues";
import { toTimelinePhase } from "@/lib/roadmap/mergeWithIssues";
import { phaseLocalDay, scrollLeftForPhase, timelineAnchorForPhases } from "@/lib/roadmap/timelineDates";
import type { TimelineZoom } from "@/lib/workspace/types";
import { pxPerDay } from "@/lib/workspace/timelineLayout";
import { TimelineHeader } from "@/components/roadmap/TimelineHeader";
import { TimelineBar } from "@/components/roadmap/TimelineBar";

type Props = {
  phases: RoadmapPhaseWithIssues[];
  canEdit?: boolean;
  compact?: boolean;
  onMovePhase: (phaseId: string, deltaDays: number) => void;
  onResizePhase: (phaseId: string, deltaDays: number) => void;
  onSelectPhase: (phase: RoadmapPhaseWithIssues) => void;
};

export function RoadmapTimeline({
  phases,
  canEdit = true,
  compact = false,
  onMovePhase,
  onResizePhase,
  onSelectPhase,
}: Props) {
  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);
  const ppd = pxPerDay(zoom);

  const sorted = useMemo(() => [...phases].sort((a, b) => a.order - b.order), [phases]);

  const totalDays = useMemo(() => {
    const base = zoom === "week" ? 42 : zoom === "quarter" ? 360 : 150;
    if (sorted.length === 0) return base;
    let maxEnd = anchor.getTime();
    for (const p of sorted) {
      const end = phaseLocalDay(p.endDate).getTime();
      const start = phaseLocalDay(p.startDate).getTime();
      maxEnd = Math.max(maxEnd, end, start);
    }
    const span = differenceInCalendarDays(new Date(maxEnd), anchor) + 14;
    return Math.max(base, span);
  }, [anchor, sorted, zoom]);

  const width = totalDays * ppd;

  const phaseFitKey = useMemo(() => sorted.map((p) => p.id).join(","), [sorted]);
  const lastFitKey = useRef("");

  useEffect(() => {
    if (!phaseFitKey || phaseFitKey === lastFitKey.current) return;
    lastFitKey.current = phaseFitKey;
    const nextAnchor = timelineAnchorForPhases(sorted);
    setAnchor(nextAnchor);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || sorted.length === 0) return;
      el.scrollLeft = scrollLeftForPhase(sorted[0].startDate, nextAnchor, ppd);
    });
  }, [phaseFitKey, ppd, sorted]);

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

  return (
    <>
      <div className="space-y-2 rounded-md border border-[#E5E7EB] bg-white p-3 lg:hidden">
        <p className="text-[12px] font-semibold text-[#1A1A1A]">フェーズ一覧</p>
        <ul className="space-y-2 text-[13px] text-[#6B7280]">
          {sorted.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-2 border-b border-[#F7F8F8] pb-2 text-left"
                onClick={() => onSelectPhase(p)}
              >
                <span className="font-medium text-[#1A1A1A]">{p.title}</span>
                <span className="shrink-0 text-[11px] text-[#6B7280]">
                  {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div
        className={`hidden flex-col rounded-md border border-[#E5E7EB] bg-white lg:flex ${compact ? "min-h-[300px]" : "min-h-[420px]"}`}
      >
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1">
          <div className="w-44 shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFA] pt-[5.25rem] text-[12px] font-medium text-[#6B7280]">
            {sorted.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex h-11 w-full items-center border-b border-[#F7F8F8] px-3 text-left hover:bg-[#F7F8F8]"
                onClick={() => onSelectPhase(p)}
              >
                <span className="truncate">{p.title}</span>
                <span className="ml-1 shrink-0 text-[10px] font-normal text-[#9CA3AF]">
                  {p.startDate.slice(5, 10)}
                </span>
              </button>
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
                const riskLate = p.status !== "completed" && new Date(p.endDate).getTime() < Date.now();
                return (
                  <TimelineBar
                    key={p.id}
                    phase={toTimelinePhase(p)}
                    anchor={anchor}
                    pxPerDay={ppd}
                    riskLate={riskLate}
                    canEdit={canEdit}
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
