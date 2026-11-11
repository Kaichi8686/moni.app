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
      ? tx("昇格ライン超え", "Above promo line")
      : zone === "stay"
        ? tx("残留ライン超え", "Above stay line")
        : tx("もう少しで残留", "Below stay line");

  return (
    <article className={`${leagueCardClass} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500">{tx("採点結果", "Score")}</p>
          <h3 className="mt-1 truncate text-base font-bold text-zinc-900">{submission.title}</h3>
        </div>
        <p className="shrink-0 text-3xl font-bold tabular-nums text-zinc-900">
          {review.score}
          <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
        </p>
      </div>

      <p className="text-[12px] font-medium text-zinc-600">{zoneLabel}</p>
      <p className="text-sm leading-relaxed text-zinc-700">{comment}</p>

      <p className="text-[11px] text-zinc-400">
        {tx("降格", "Down")} {AI_DEMOTION_LINE} · {tx("残留", "Stay")} {AI_STAY_LINE} ·{" "}
        {tx("昇格", "Up")} {AI_PROMOTION_LINE}
      </p>
    </article>
  );
}
