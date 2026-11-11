"use client";

import { LeagueCountdown } from "@/components/idea-league/LeagueCountdown";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { AI_PROMOTION_LINE } from "@/lib/idea-league/aiReview";
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
  const progress =
    members.length > 0
      ? computeLeagueProgress(members, promotionCutoff, { preferAiThresholds: true })
      : null;
  const label = locale === "en" ? meta.labelEn : meta.labelJa;
  const nextLabel = nextMeta ? (locale === "en" ? nextMeta.labelEn : nextMeta.labelJa) : null;

  const demoPct = progress?.demotionMarkerPercent ?? 22;
  const stayPct = progress?.stayMarkerPercent ?? 48;
  const promoPct = progress?.promotionMarkerPercent ?? 72;
  const fillPct = progress?.fillPercent ?? 18;
  const zone: LeagueZone = progress?.zone ?? "risk";
  const myScore = progress?.myScore ?? 0;
  const pointsToPromotion =
    progress?.pointsToPromotion ?? Math.max(0, AI_PROMOTION_LINE - myScore);
  const promoTarget = progress?.promotionLineScore ?? AI_PROMOTION_LINE;

  return (
    <section className={`${leagueCardClass} lg:min-h-[24rem]`} aria-label={label}>
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
            label={countdownLabel ?? tx("判定まで", "Until judgment")}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3.5">
        <LeagueTierBadge tier={tier} size="lg" showLabel={false} flat />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-[1.35rem]">{label}</h1>
          <p className="mt-1 text-[13px] leading-snug text-zinc-500">
            {locale === "en" ? meta.descriptionEn : meta.descriptionJa}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-zinc-500">
              {tx("現在の勝ち点", "Current points")}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
              {myScore}
              <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-zinc-500">
              {tx("目標昇格pt", "Promo target")}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-800">
              {promoTarget}
              <span className="ml-0.5 text-xs font-medium text-zinc-400">pt</span>
            </p>
            {zone !== "promote" ? (
              <p className="mt-1 text-[12px] font-medium text-emerald-700">
                {tx(`昇格まであと ${pointsToPromotion}pt`, `${pointsToPromotion}pt to promote`)}
              </p>
            ) : (
              <p className="mt-1 text-[12px] font-medium text-emerald-700">
                {tx("昇格ライン突破中", "Above promotion line")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <ZoneChip zone={zone} rank={progress?.myRank ?? null} nextLabel={nextLabel} tx={tx} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between gap-1 text-[10px] font-semibold tracking-wide">
          <span className="inline-flex items-center gap-1 text-rose-600">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
            {tx("降格", "Demo")}
          </span>
          <span className="inline-flex items-center gap-1 text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden />
            {tx("残留", "Stay")}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
            {tx("昇格", "Promo")}
          </span>
        </div>

        <div className="relative h-4 overflow-hidden rounded-full border border-zinc-200/80 bg-zinc-100">
          <div className="absolute inset-y-0 left-0 bg-rose-100" style={{ width: `${demoPct}%` }} />
          <div
            className="absolute inset-y-0 bg-zinc-100"
            style={{ left: `${demoPct}%`, width: `${Math.max(stayPct - demoPct, 0)}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-100/90"
            style={{ left: `${stayPct}%`, width: `${Math.max(promoPct - stayPct, 0)}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-200/90"
            style={{ left: `${promoPct}%`, width: `${Math.max(100 - promoPct, 0)}%` }}
          />

          <Tick percent={demoPct} className="bg-rose-500" />
          <Tick percent={stayPct} className="bg-zinc-500" />
          <Tick percent={promoPct} className="bg-emerald-700" />

          <div
            className="absolute top-1/2 z-[3] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-[left] duration-500 ease-out"
            style={{ left: `${Math.min(96, Math.max(4, fillPct))}%` }}
          >
            <span className="h-5 w-5 rounded-full border-[2.5px] border-white bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
          </div>
        </div>

        <div className="relative mt-2.5 h-5 text-[10px] font-medium text-zinc-500">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-rose-600"
            style={{ left: `${clampLabel(demoPct)}%` }}
          >
            {tx("降格ライン", "Demotion")}
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${clampLabel(stayPct)}%` }}
          >
            {tx("残留ライン", "Stay")}
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-emerald-700"
            style={{ left: `${clampLabel(promoPct)}%` }}
          >
            {tx("昇格ライン", "Promo")}
          </span>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          {tx(
            "初期フェーズはAI審査の勝ち点でゾーンが決まります。",
            "In the early phase, AI review points set your zone.",
          )}
        </p>
      </div>

      {idleHint && !progress ? (
        <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">
          {tx(
            "アイデアを提出すると、判定フェーズで勝ち点が入ります。",
            "Submit an idea — judgment phase awards your points.",
          )}
        </p>
      ) : null}
    </section>
  );
}

function clampLabel(pct: number) {
  return Math.min(88, Math.max(12, pct));
}

function ZoneChip({
  zone,
  rank,
  nextLabel,
  tx,
}: {
  zone: LeagueZone;
  rank: number | null;
  nextLabel: string | null;
  tx: (ja: string, en: string) => string;
}) {
  if (zone === "promote") {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
        {tx("昇格ゾーン", "Promotion")}
        {rank ? ` · #${rank}` : ""}
        {nextLabel ? ` → ${nextLabel}` : ""}
      </p>
    );
  }
  if (zone === "risk") {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-800">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
        {tx("降格ゾーン", "Demotion")}
        {rank ? ` · #${rank}` : ""}
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden />
      {tx("残留ゾーン", "Stay")}
      {rank ? ` · #${rank}` : ""}
    </p>
  );
}

function Tick({ percent, className }: { percent: number; className: string }) {
  return (
    <div
      className={`absolute top-0 z-[2] h-full w-0.5 -translate-x-1/2 ${className}`}
      style={{ left: `${Math.min(98, Math.max(2, percent))}%` }}
      aria-hidden
    />
  );
}
