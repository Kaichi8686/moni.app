"use client";

import { Lightbulb } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { daysLeft } from "@/lib/contest/api";
import type { Contest } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  contest: Contest;
  ideaCount: number;
  onApply: () => void;
  demo?: boolean;
};

export function ContestHeader({ contest, ideaCount, onApply, demo }: Props) {
  const { tx } = useI18n();
  const left = daysLeft(contest.endAt);
  const active = contest.status === "active" && left > 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[var(--shadow-sm)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_12%_0%,rgba(255,150,0,0.14),transparent_55%),radial-gradient(ellipse_70%_60%_at_100%_20%,rgba(94,106,210,0.10),transparent_50%)]"
      />
      <div className="relative space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight ${
              active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80" : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`} aria-hidden />
            {active ? tx("開催中", "Live") : tx("終了", "Ended")}
          </span>
          {active ? (
            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200/80">
              {tx(`残り ${left}日`, `${left}d left`)}
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-600 ring-1 ring-zinc-200">
            {tx(`${ideaCount} 投稿`, `${ideaCount} posts`)}
          </span>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {tx("今月のお題", "This month’s challenge")}
          </p>
          <h1 className="mt-1.5 text-[1.35rem] font-semibold leading-snug tracking-tight text-zinc-950 sm:text-[1.55rem]">
            {contest.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{contest.description}</p>
        </div>

        {contest.whyText ? (
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3">
            <p className="text-[11px] font-semibold text-zinc-500">{tx("なぜこの課題か", "Why this challenge")}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{contest.whyText}</p>
          </div>
        ) : null}

        <DuoButton type="button" fullWidth size="lg" onClick={onApply} disabled={!active} className="gap-2">
          <Lightbulb className="h-4 w-4" aria-hidden />
          {tx("アイデアを発表・応募する", "Share your idea")}
        </DuoButton>
      </div>
    </section>
  );
}
