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
  onEarnPoints?: () => void;
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
  onEarnPoints,
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
  const fillPct = progress?.fillPercent ?? 8;
  const zone: LeagueZone = progress?.zone ?? "risk";
  const myScore = progress?.myScore ?? 0;
  const pointsToPromotion =
    progress?.pointsToPromotion ?? Math.max(0, AI_PROMOTION_LINE - myScore);
  const promoTarget = progress?.promotionLineScore ?? AI_PROMOTION_LINE;

  return (
    <section className={`${leagueCardClass} lg:min-h-[22rem]`} aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium text-zinc-500">
          {phaseLabel ?? tx("アイデアリーグ", "Idea League")}
        </p>
        {countdownTarget ? (
          <LeagueCountdown
            compact
            pill
            active={countdownActive}
            target={countdownTarget}
            label={countdownLabel ?? tx("締切まで", "Until close")}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <LeagueTierBadge tier={tier} size="lg" showLabel={false} flat />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{label}</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            {locale === "en" ? meta.descriptionEn : meta.descriptionJa}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-zinc-100 pt-4">
        <div>
          <p className="text-[11px] text-zinc-500">{tx("勝ち点", "Points")}</p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-zinc-900">
            {myScore}
            <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-zinc-500">{tx("昇格", "Promo")}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-800">{promoTarget} pt</p>
          {zone !== "promote" ? (
            <p className="mt-1 text-[12px] text-zinc-500">
              {tx(`あと ${pointsToPromotion}pt`, `${pointsToPromotion}pt to go`)}
            </p>
          ) : nextLabel ? (
            <p className="mt-1 text-[12px] text-zinc-500">→ {nextLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <ZoneChip zone={zone} rank={progress?.myRank ?? null} tx={tx} />
      </div>

      <div className="mt-5">
        <div className="relative h-3 overflow-hidden rounded-full bg-zinc-100">
          <div className="absolute inset-y-0 left-0 bg-zinc-200" style={{ width: `${demoPct}%` }} />
          <div
            className="absolute inset-y-0 bg-zinc-100"
            style={{ left: `${demoPct}%`, width: `${Math.max(stayPct - demoPct, 0)}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-100"
            style={{ left: `${stayPct}%`, width: `${Math.max(100 - stayPct, 0)}%` }}
          />
          <Tick percent={demoPct} className="bg-zinc-400" />
          <Tick percent={stayPct} className="bg-zinc-500" />
          <Tick percent={promoPct} className="bg-emerald-600" />
          <div
            className="absolute top-1/2 z-[3] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900"
            style={{ left: `${Math.min(96, Math.max(4, fillPct))}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
          <span>{tx("降格", "Down")}</span>
          <span>{tx("残留", "Stay")}</span>
          <span className="text-emerald-700">{tx("昇格", "Up")}</span>
        </div>
      </div>

      {myScore === 0 && onEarnPoints ? (
        <button
          type="button"
          onClick={onEarnPoints}
          className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          {tx("アイデアを提出する", "Submit an idea")}
        </button>
      ) : null}

      {idleHint && !progress ? (
        <p className="mt-3 text-[12px] text-zinc-400">
          {tx("毎日お題が更新されます。提出でptが入ります。", "Daily prompts — submit to earn pt.")}
        </p>
      ) : null}
    </section>
  );
}

function ZoneChip({
  zone,
  rank,
  tx,
}: {
  zone: LeagueZone;
  rank: number | null;
  tx: (ja: string, en: string) => string;
}) {
  const label =
    zone === "promote"
      ? tx("昇格圏", "Promotion")
      : zone === "risk"
        ? tx("降格圏", "Demotion")
        : tx("残留圏", "Stay");
  return (
    <p className="text-[11px] font-medium text-zinc-600">
      {label}
      {rank ? ` · #${rank}` : ""}
    </p>
  );
}

function Tick({ percent, className }: { percent: number; className: string }) {
  return (
    <div
      className={`absolute top-0 z-[2] h-full w-px -translate-x-1/2 ${className}`}
      style={{ left: `${Math.min(98, Math.max(2, percent))}%` }}
      aria-hidden
    />
  );
}
