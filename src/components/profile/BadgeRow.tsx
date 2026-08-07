"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  Flame,
  Gem,
  Mic,
  PenLine,
  Rocket,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BADGE_DEFINITIONS, type EarnedBadge } from "@/lib/gamification/badges";

type Props = {
  badges: EarnedBadge[];
};

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_post: PenLine,
  first_project: Rocket,
  team_player: Users,
  first_sale: CircleDollarSign,
  pitch_done: Mic,
  streak_7: Flame,
  streak_30: Zap,
  fundraised: Gem,
};

function formatEarnedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

export function BadgeRow({ badges }: Props) {
  const earnedMap = new Map(badges.map((b) => [b.id, b.earned_at]));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeDef = activeId ? BADGE_DEFINITIONS.find((b) => b.id === activeId) : null;
  const activeEarnedAt = activeId ? earnedMap.get(activeId) : undefined;
  const ActiveIcon = activeId ? BADGE_ICONS[activeId] ?? BadgeCheck : BadgeCheck;

  return (
    <>
      <div className="border-b border-zinc-200 bg-white px-4 py-3.5 sm:px-5">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">実績</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BADGE_DEFINITIONS.map((def) => {
            const earned = earnedMap.has(def.id);
            const Icon = BADGE_ICONS[def.id] ?? BadgeCheck;
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => setActiveId(def.id)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  earned
                    ? "border-zinc-300 bg-white hover:border-zinc-400"
                    : "border-zinc-100 bg-zinc-50/80 opacity-55 hover:opacity-80"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                    earned ? "border-zinc-200 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[12px] font-semibold ${earned ? "text-zinc-900" : "text-zinc-500"}`}>
                    {def.label}
                  </span>
                  <span className="block text-[10px] text-zinc-400">{earned ? "獲得済み" : "未獲得"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeDef ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-zinc-900/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-detail-title"
          onClick={() => setActiveId(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-xl border border-zinc-200 bg-white p-5 shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                  activeEarnedAt ? "border-zinc-200 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              >
                <ActiveIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="badge-detail-title" className="text-[16px] font-semibold tracking-tight text-zinc-900">
                  {activeDef.label}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{activeDef.description}</p>
                <p className="mt-2 text-[12px] text-zinc-400">
                  {activeEarnedAt ? `獲得日: ${formatEarnedAt(activeEarnedAt)}` : "まだ獲得していません"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-lg bg-zinc-900 py-2.5 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
              onClick={() => setActiveId(null)}
            >
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
