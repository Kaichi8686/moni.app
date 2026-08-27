"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

function PhaseList({
  phases,
  onSelectPhase,
}: {
  phases: RoadmapPhaseWithIssues[];
  onSelectPhase: (phase: RoadmapPhaseWithIssues) => void;
}) {
  return (
    <ul className="divide-y divide-[#F3F4F6]">
      {phases.map((p) => {
        const riskLate = p.status !== "completed" && new Date(p.endDate).getTime() < Date.now();
        return (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-1 px-4 py-3.5 text-left transition hover:bg-[#F9FAFB] active:bg-[#F3F4F6]"
              onClick={() => onSelectPhase(p)}
            >
              <span className="text-[15px] font-semibold leading-snug text-[#1A1A1A]">{p.title}</span>
              <span className="text-sm text-[#6B7280]">
                {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
                {riskLate ? <span className="ml-2 font-medium text-rose-600">遅延気味</span> : null}
              </span>
              {p.goal ? <span className="line-clamp-2 text-sm leading-relaxed text-[#6B7280]">{p.goal}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function GanttBody({
  sorted,
  anchor,
  totalDays,
  width,
  ppd,
  zoom,
  setZoom,
  canEdit,
  showLabels,
  scrollRef,
  onPrev,
  onNext,
  onToday,
  onMovePhase,
  onResizePhase,
  onSelectPhase,
}: {
  sorted: RoadmapPhaseWithIssues[];
  anchor: Date;
  totalDays: number;
  width: number;
  ppd: number;
  zoom: TimelineZoom;
  setZoom: (z: TimelineZoom) => void;
  canEdit: boolean;
  showLabels: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMovePhase: (phaseId: string, deltaDays: number) => void;
  onResizePhase: (phaseId: string, deltaDays: number) => void;
  onSelectPhase: (phase: RoadmapPhaseWithIssues) => void;
}) {
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex min-h-0 flex-1">
        {showLabels ? (
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
        ) : null}
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
  );
}

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
  const [mobileTimeline, setMobileTimeline] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const ppd = pxPerDay(zoom);

  const sorted = useMemo(() => [...phases].sort((a, b) => a.order - b.order), [phases]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMdUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
      const el = isMdUp ? desktopScrollRef.current : mobileScrollRef.current;
      if (!el || sorted.length === 0) return;
      el.scrollLeft = scrollLeftForPhase(sorted[0].startDate, nextAnchor, ppd);
    });
  }, [phaseFitKey, ppd, sorted, isMdUp]);

  const onPrev = () => setAnchor((a) => addDays(a, zoom === "week" ? -14 : -30));
  const onNext = () => setAnchor((a) => addDays(a, zoom === "week" ? 14 : 30));
  const onToday = () => {
    const t = new Date();
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    setAnchor(monthStart);
    requestAnimationFrame(() => {
      const el = isMdUp ? desktopScrollRef.current : mobileScrollRef.current;
      if (!el) return;
      const off = differenceInCalendarDays(t, monthStart) * ppd;
      el.scrollTo({ left: Math.max(0, off - el.clientWidth / 2), behavior: "smooth" });
    });
  };

  const ganttProps = {
    sorted,
    anchor,
    totalDays,
    width,
    ppd,
    zoom,
    setZoom,
    canEdit,
    onPrev,
    onNext,
    onToday,
    onMovePhase,
    onResizePhase,
    onSelectPhase,
  };

  return (
    <div className="flex flex-col gap-3">
      {!isMdUp ? (
        <div className="rounded-md border border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <p className="text-[16px] font-semibold text-[#1A1A1A]">フェーズ</p>
            <button
              type="button"
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] font-semibold text-[#374151]"
              onClick={() => setMobileTimeline((v) => !v)}
            >
              {mobileTimeline ? "リスト表示" : "タイムライン"}
            </button>
          </div>
          {mobileTimeline ? (
            <div className={`flex flex-col ${compact ? "min-h-[260px]" : "min-h-[320px]"}`}>
              <GanttBody {...ganttProps} showLabels={false} scrollRef={mobileScrollRef} />
            </div>
          ) : (
            <PhaseList phases={sorted} onSelectPhase={onSelectPhase} />
          )}
        </div>
      ) : (
        <div
          className={`flex flex-col rounded-md border border-[#E5E7EB] bg-white ${compact ? "min-h-[300px]" : "min-h-[420px]"}`}
        >
          <GanttBody {...ganttProps} showLabels scrollRef={desktopScrollRef} />
        </div>
      )}
    </div>
  );
}
