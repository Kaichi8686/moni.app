"use client";

import type { RoadmapStepFull } from "@/components/projects/ProjectRoadmapPanel";
import { roadmapStepDisplay } from "@/lib/ai/roadmapStepDisplay";

type Props = {
  step: RoadmapStepFull;
  stepNumber: number;
  className?: string;
};

export function RoadmapStepActionCard({ step, stepNumber, className = "" }: Props) {
  const display = roadmapStepDisplay(step, stepNumber - 1);

  if (!display.hasStructuredContent) {
    return (
      <p className={`text-sm leading-relaxed text-zinc-700 ${className}`}>
        &ldquo;{display.action}&rdquo;
      </p>
    );
  }

  return (
    <div className={`space-y-2 rounded-xl border border-orange-100/80 bg-orange-50/40 px-3 py-2.5 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-orange-900/70">
        ステップ{stepNumber}（{display.timelineLabel}）
      </p>
      <dl className="space-y-1.5 text-sm leading-relaxed text-zinc-800">
        <div>
          <dt className="text-[11px] font-semibold text-zinc-500">やること</dt>
          <dd className="font-medium text-[#1A1A1A]">{display.action}</dd>
        </div>
        {display.why ? (
          <div>
            <dt className="text-[11px] font-semibold text-zinc-500">なぜ</dt>
            <dd>{display.why}</dd>
          </div>
        ) : null}
        {display.how ? (
          <div>
            <dt className="text-[11px] font-semibold text-zinc-500">どうやって</dt>
            <dd>{display.how}</dd>
          </div>
        ) : null}
        {display.fallback ? (
          <div>
            <dt className="text-[11px] font-semibold text-zinc-500">うまくいかなかったら</dt>
            <dd className="text-zinc-600">{display.fallback}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
