"use client";

import { LeagueCountdown } from "@/components/idea-league/LeagueCountdown";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { computeLeagueProgress, type LeagueZone } from "@/lib/idea-league/progress";
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
  idleHint?: boolean;
  countdownActive?: boolean;
};

export function LeagueStatusCard({
  tier,
  phaseLabel,
  countdownTarget,
  countdownLabel,
  members = [],
  promotionCutoff = PROMOTION_SLOTS,
  idleHint,
  countdownActive = true,
}: Props) {
  const { locale, tx } = useI18n();
  const meta = LEAGUE_TIER_META[tier];
  const next = nextLeagueTier(tier);
  const nextMeta = next ? LEAGUE_TIER_META[next] : null;
  const progress = members.length > 0 ? computeLeagueProgress(members, promotionCutoff) : null;
  const label = locale === "en" ? meta.labelEn : meta.labelJa;
  const nextLabel = nextMeta ? (locale === "en" ? nextMeta.labelEn : nextMeta.labelJa) : null;

  const promoPct = progress?.promotionMarkerPercent ?? 72;
  const stayPct = Math.min(promoPct - 1, progress?.stayMarkerPercent ?? 40);
  const fillPct = progress?.fillPercent ?? 8;
  const zone: LeagueZone = progress?.zone ?? "stay";

  return (
    <section className={`${leagueCardClass} lg:min-h-[22rem]`} aria-label={label}>
      {/* Top: phase + countdown chip */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          {phaseLabel ?? tx("アイデアリーグ", "Idea League")}
        </p>
        {countdownTarget ? (
          <LeagueCountdown
            compact
            pill
            active={countdownActive}
            target={countdownTarget}
            label={countdownLabel ?? tx("残り", "Left")}
          />
        ) : null}
      </div>

      {/* Rank badge + title */}
      <div className="mt-4 flex items-center gap-3.5">
        <LeagueTierBadge tier={tier} size="lg" showLabel={false} flat />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-[1.35rem]">{label}</h1>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            {locale === "en" ? meta.descriptionEn : meta.descriptionJa}
          </p>
        </div>
      </div>

      {/* Points + zone chip */}
      <div className="mt-6 flex items-end justify-between gap-3 border-t border-zinc-100 pt-5">
        <div>
          <p className="text-[11px] font-medium text-zinc-500">
            {tx("今週のポイント", "This week's points")}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
            {progress ? progress.myScore : 0}
            <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
          </p>
        </div>
        <ZoneChip
          zone={zone}
          rank={progress?.myRank ?? null}
          pointsToPromotion={progress?.pointsToPromotion}
          nextLabel={nextLabel}
          promotionCutoff={promotionCutoff}
          tx={tx}
        />
      </div>

      {/* eFootball-style zone track + live position */}
      <div className="mt-5">
        <div className="relative h-3 overflow-hidden rounded-full bg-zinc-100">
          {/* Zone bands (score axis: left=low, right=high) */}
          <div
            className="absolute inset-y-0 left-0 bg-zinc-200/80"
            style={{ width: `${Math.max(stayPct, 0)}%` }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 bg-zinc-100"
            style={{
              left: `${Math.max(stayPct, 0)}%`,
              width: `${Math.max(promoPct - stayPct, 0)}%`,
            }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 bg-emerald-100"
            style={{ width: `${Math.max(100 - promoPct, 0)}%` }}
            aria-hidden
          />

          {/* Current score fill (subtle) */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-zinc-800/90 transition-[width] duration-500 ease-out"
            style={{ width: `${fillPct}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress?.maxScore ?? 100}
            aria-valuenow={progress?.myScore ?? 0}
          />

          {/* Line ticks */}
          <Tick percent={stayPct} className="bg-zinc-400" />
          <Tick percent={promoPct} className="bg-emerald-600" />

          {/* Live position marker */}
          <div
            className="absolute top-1/2 z-[2] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 shadow-sm transition-[left] duration-500 ease-out"
            style={{ left: `${Math.min(98, Math.max(2, fillPct))}%` }}
            aria-hidden
          />
        </div>

        <div className="relative mt-2 h-4 text-[10px] font-medium text-zinc-500">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.min(92, Math.max(8, stayPct))}%` }}
          >
            {tx("維持ライン", "Stay line")}
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-emerald-700"
            style={{ left: `${Math.min(94, Math.max(12, promoPct))}%` }}
          >
            {tx("昇格ライン", "Promo line")}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-zinc-500">
          <LegendDot className="bg-emerald-200" label={tx("昇格ゾーン", "Promotion")} />
          <LegendDot className="bg-zinc-100 ring-1 ring-zinc-200" label={tx("残留ゾーン", "Stay")} />
          <LegendDot className="bg-zinc-200" label={tx("下位", "Lower")} />
        </div>
      </div>

      {idleHint && !progress ? (
        <p className="mt-4 text-[12px] leading-relaxed text-zinc-400">
          {tx(
            "バトルが始まると、票に合わせて位置が動きます。",
            "Once the battle starts, your marker moves with votes.",
          )}
        </p>
      ) : null}
    </section>
  );
}

function ZoneChip({
  zone,
  rank,
  pointsToPromotion,
  nextLabel,
  promotionCutoff,
  tx,
}: {
  zone: LeagueZone;
  rank: number | null;
  pointsToPromotion?: number;
  nextLabel: string | null;
  promotionCutoff: number;
  tx: (ja: string, en: string) => string;
}) {
  if (zone === "promote") {
    return (
      <p className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        {tx("昇格ゾーン内", "Promotion zone")}
        {rank ? ` · #${rank}` : ""}
      </p>
    );
  }
  if (zone === "risk") {
    return (
      <div className="text-right">
        <p className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          {tx("下位ゾーン", "Lower zone")}
          {rank ? ` · #${rank}` : ""}
        </p>
        {nextLabel ? (
          <p className="mt-1 text-[11px] text-zinc-400">
            {tx(
              `昇格まであと ${pointsToPromotion ?? "—"} pt`,
              `${pointsToPromotion ?? "—"} pt to promote`,
            )}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="text-right">
      <p className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
        {tx("残留ゾーン", "Stay zone")}
        {rank ? ` · #${rank}` : ""}
      </p>
      {nextLabel ? (
        <p className="mt-1 text-[11px] text-zinc-400">
          {tx(
            `昇格まであと ${pointsToPromotion ?? "—"} pt · TOP ${promotionCutoff}`,
            `${pointsToPromotion ?? "—"} pt · TOP ${promotionCutoff}`,
          )}
        </p>
      ) : null}
    </div>
  );
}

function Tick({ percent, className }: { percent: number; className: string }) {
  return (
    <div
      className={`absolute top-0 z-[1] h-full w-0.5 -translate-x-1/2 ${className}`}
      style={{ left: `${Math.min(98, Math.max(2, percent))}%` }}
      aria-hidden
    />
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${className}`} aria-hidden />
      {label}
    </span>
  );
}
