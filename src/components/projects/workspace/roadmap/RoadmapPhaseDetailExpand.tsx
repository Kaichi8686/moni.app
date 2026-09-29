"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  title: string;
  goal?: string;
  description?: string;
  stepNumber?: number;
  compact?: boolean;
};

export function RoadmapPhaseDetailExpand({ open, title, goal, description, stepNumber, compact = false }: Props) {
  const { tx } = useI18n();
  if (!open) return null;

  return (
    <div
      className={`roadmap-phase-detail-expand overflow-hidden rounded-2xl border border-orange-100 bg-orange-50/70 ${
        compact ? "mt-1.5 px-2.5 py-2" : "mt-2 px-3 py-3"
      }`}
    >
      {stepNumber != null ? (
        <p className={`font-bold tracking-[0.12em] text-zinc-400 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          STEP {stepNumber}
        </p>
      ) : null}
      <p className={`font-bold text-zinc-900 ${compact ? "mt-0.5 text-[12px] leading-snug" : "mt-1 text-sm"}`}>{title}</p>
      <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-3"}>
        <div>
          <p className={`font-bold text-orange-900 ${compact ? "text-[10px]" : "text-xs"}`}>
            {tx("ゴール", "Goal")}
          </p>
          {goal?.trim() ? (
            <p className={`mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-800 ${compact ? "text-[11px]" : "text-sm"}`}>
              {goal}
            </p>
          ) : (
            <p className={`mt-0.5 text-zinc-400 ${compact ? "text-[11px]" : "text-sm"}`}>
              {tx("まだ書かれていません", "Not set yet")}
            </p>
          )}
        </div>
        <div>
          <p className={`font-semibold text-zinc-600 ${compact ? "text-[10px]" : "text-xs"}`}>
            {tx("概要", "Overview")}
          </p>
          {description?.trim() ? (
            <p className={`mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-700 ${compact ? "text-[11px]" : "text-sm"}`}>
              {description}
            </p>
          ) : (
            <p className={`mt-0.5 text-zinc-400 ${compact ? "text-[11px]" : "text-sm"}`}>
              {tx("まだ書かれていません", "Not set yet")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
