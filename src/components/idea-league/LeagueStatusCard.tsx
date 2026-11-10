"use client";

import { LeagueCountdown } from "@/components/idea-league/LeagueCountdown";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { computeLeagueProgress } from "@/lib/idea-league/progress";
import {
  LEAGUE_TIER_META,
  nextLeagueTier,
  PROMOTION_SLOTS,
} from "@/lib/idea-league/tiers";
import type { LeagueMember, LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  tier: LeagueTier;
  phaseLabel?: string;
  countdownTarget?: Date | null;
  countdownLabel?: string;
  members?: LeagueMember[];
  promotionCutoff?: number;
  /** Waiting / no active scores yet */
  idleHint?: boolean;
};

export function LeagueStatusCard({
  tier,
  phaseLabel,
  countdownTarget,
  countdownLabel,
  members = [],
  promotionCutoff = PROMOTION_SLOTS,
  idleHint,
}: Props) {
  const { locale, tx } = useI18n();
  const meta = LEAGUE_TIER_META[tier];
  const next = nextLeagueTier(tier);
  const nextMeta = next ? LEAGUE_TIER_META[next] : null;
  const progress = members.length > 0 ? computeLeagueProgress(members, promotionCutoff) : null;
  const label = locale === "en" ? meta.labelEn : meta.labelJa;
  const nextLabel = nextMeta ? (locale === "en" ? nextMeta.labelEn : nextMeta.labelJa) : null;

  return (
    <section
      className="rounded-[28px] border border-zinc-200/90 bg-white p-4 sm:p-5"
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {phaseLabel ? (
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500">{phaseLabel}</p>
          ) : (
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500">
              {tx("アイデアリーグ", "Idea League")}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <LeagueTierBadge tier={tier} size="lg" showLabel={false} flat />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                {label}
              </h1>
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-zinc-500">
                {locale === "en" ? meta.descriptionEn : meta.descriptionJa}
              </p>
            </div>
          </div>
        </div>

        {countdownTarget ? (
          <LeagueCountdown
            compact
            pill
            target={countdownTarget}
            label={countdownLabel ?? tx("残り", "Left")}
          />
        ) : null}
      </div>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-zinc-500">
              {tx("今週のポイント", "This week's points")}
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
              {progress ? progress.myScore : 0}
              <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
            </p>
          </div>
          <div className="text-right">
            {progress?.inPromotionZone ? (
              <p className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {tx("昇格ゾーン内", "In promotion zone")}
                {progress.myRank ? ` · #${progress.myRank}` : ""}
              </p>
            ) : nextLabel ? (
              <p className="text-[13px] font-semibold text-zinc-800">
                {tx(
                  `昇格まであと ${progress?.pointsToPromotion ?? "—"} pt`,
                  `${progress?.pointsToPromotion ?? "—"} pt to ${nextLabel}`,
                )}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-zinc-700">
                {tx("最高リーグ到達", "Top league reached")}
              </p>
            )}
            {nextLabel && !progress?.inPromotionZone ? (
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {tx(`次: ${nextLabel}`, `Next: ${nextLabel}`)} · TOP {promotionCutoff}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 h-2 rounded-full bg-zinc-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-zinc-800 transition-[width] duration-300 ease-out"
            style={{ width: `${progress?.fillPercent ?? 8}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress?.maxScore ?? 100}
            aria-valuenow={progress?.myScore ?? 0}
          />

          {progress ? (
            <>
              <Marker percent={progress.promotionMarkerPercent} tone="promote" />
              <Marker percent={progress.stayMarkerPercent} tone="stay" />
            </>
          ) : (
            <Marker percent={72} tone="promote" />
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-px bg-emerald-600" aria-hidden />
            {tx("昇格ライン", "Promotion line")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-px bg-zinc-400" aria-hidden />
            {tx("維持ライン", "Safety line")}
          </span>
        </div>

        {idleHint && !progress ? (
          <p className="mt-3 text-[12px] text-zinc-400">
            {tx(
              "バトルが始まると、票に合わせてゲージが動きます。",
              "Once the battle starts, this gauge moves with your votes.",
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Marker({ percent, tone }: { percent: number; tone: "promote" | "stay" }) {
  const clamped = Math.min(98, Math.max(2, percent));
  const color = tone === "promote" ? "bg-emerald-600" : "bg-zinc-400";
  return (
    <div
      className="pointer-events-none absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${clamped}%` }}
      aria-hidden
    >
      <div className={`h-3.5 w-0.5 ${color}`} />
    </div>
  );
}
