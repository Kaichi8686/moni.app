"use client";

import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import {
  AI_DEMOTION_LINE,
  AI_PROMOTION_LINE,
  AI_STAY_LINE,
  zoneForAiScore,
} from "@/lib/idea-league/aiReview";
import type { LeagueAiReview, LeagueSubmission } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  submission: LeagueSubmission;
  review: LeagueAiReview;
};

export function AiReviewCard({ submission, review }: Props) {
  const { locale, tx } = useI18n();
  const zone = zoneForAiScore(review.score);
  const comment = locale === "en" ? review.commentEn : review.commentJa;

  const zoneLabel =
    zone === "promote"
      ? tx("⭐ 昇格ライン突破", "⭐ Above promotion line")
      : zone === "stay"
        ? tx("🟢 残留ラインクリア", "🟢 Above stay line")
        : tx("🔴 降格ライン付近", "🔴 Near demotion line");

  const zoneCls =
    zone === "promote"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : zone === "stay"
        ? "border-zinc-200 bg-zinc-50 text-zinc-700"
        : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <article className={`${leagueCardClass} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500">
            {tx("AI審査結果", "AI review")}
          </p>
          <h3 className="mt-1 truncate text-base font-bold text-zinc-900">{submission.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
            {review.score}
            <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
          </p>
          <p className="text-[10px] font-medium text-zinc-400">
            {tx("勝ち点", "Match points")}
          </p>
        </div>
      </div>

      <p className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${zoneCls}`}>
        {zoneLabel}
      </p>

      <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3">
        <p className="text-[11px] font-medium text-zinc-500">
          {tx("フィードバック", "Feedback")}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{comment}</p>
      </div>

      <ul className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
        <li className="rounded-lg border border-rose-100 bg-rose-50/70 px-2 py-2 text-rose-700">
          🔴 {tx("降格", "Demo")}
          <span className="mt-0.5 block tabular-nums text-zinc-600">{AI_DEMOTION_LINE}pt</span>
        </li>
        <li className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-zinc-700">
          🟢 {tx("残留", "Stay")}
          <span className="mt-0.5 block tabular-nums text-zinc-600">{AI_STAY_LINE}pt</span>
        </li>
        <li className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-2 py-2 text-emerald-800">
          ⭐ {tx("昇格", "Promo")}
          <span className="mt-0.5 block tabular-nums text-zinc-600">{AI_PROMOTION_LINE}pt</span>
        </li>
      </ul>
    </article>
  );
}
