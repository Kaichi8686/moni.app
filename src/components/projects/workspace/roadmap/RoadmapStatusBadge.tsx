"use client";

import type { PhaseStatus } from "@/lib/roadmap/types";

const LABELS: Record<PhaseStatus, string> = {
  planned: "予定",
  in_progress: "進行中",
  paused: "一時停止",
  completed: "完了",
};

const STYLES: Record<PhaseStatus, string> = {
  planned: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-[var(--brand-soft,#fff4f0)] text-[var(--brand-ink,#9a3412)]",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export function RoadmapStatusBadge({ status }: { status: PhaseStatus }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
