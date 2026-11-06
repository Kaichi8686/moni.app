"use client";

import { Clock3, Lightbulb } from "lucide-react";
import { daysLeft } from "@/lib/contest/api";
import type { Contest } from "@/lib/contest/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  contest: Contest;
  ideaCount: number;
  onApply: () => void;
  demo?: boolean;
};

export function ContestHeader({ contest, ideaCount, onApply }: Props) {
  const { tx } = useI18n();
  const left = daysLeft(contest.endAt);
  const active = contest.status === "active" && left > 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-300"}`}
              aria-hidden
            />
            {active ? tx("開催中", "Live") : tx("終了", "Ended")}
          </span>
          {active ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 className="h-3 w-3" aria-hidden />
              {tx(`${left}日`, `${left}d`)}
            </span>
          ) : null}
          <span className="tabular-nums">
            {tx(`${ideaCount} 投稿`, `${ideaCount} posts`)}
          </span>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            {tx("今月のお題", "This month’s challenge")}
          </p>
          <h1 className="mt-1.5 text-[1.25rem] font-semibold leading-snug tracking-tight text-zinc-950 sm:text-[1.4rem]">
            {contest.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{contest.description}</p>
        </div>

        {contest.whyText ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
            <p className="text-[11px] font-medium text-zinc-500">{tx("なぜこの課題か", "Why this challenge")}</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{contest.whyText}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onApply}
          disabled={!active}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[13px] font-medium text-white transition hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Lightbulb className="h-4 w-4" aria-hidden />
          {tx("発表する", "Share")}
        </button>
      </div>
    </section>
  );
}
