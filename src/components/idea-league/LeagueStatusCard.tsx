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

  // Idle demo geometry so empty state still shows clear eFootball-like zones.
  const promoPct = progress?.promotionMarkerPercent ?? 70;
  const stayPct = Math.min(promoPct - 8, progress?.stayMarkerPercent ?? 38);
  const fillPct = progress?.fillPercent ?? 78;
  const zone: LeagueZone = progress?.zone ?? "promote";

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
            label={countdownLabel ?? tx("残り", "Left")}
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

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-zinc-100 pt-5">
        <div>
          <p className="text-[11px] font-medium text-zinc-500">
            {tx("今週のポイント", "This week's points")}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
            {progress ? progress.myScore : 0}
            <span className="ml-1 text-sm font-medium text-zinc-400">pt</span>
          </p>
          {progress?.myRank ? (
            <p className="mt-1 text-[12px] font-medium text-zinc-500">
              {tx(`現在 ${progress.myRank} 位 / ${progress.groupSize} 人`, `Rank #${progress.myRank} of ${progress.groupSize}`)}
            </p>
          ) : null}
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

      {/* Zone track — always spread so 0pt still reads clearly */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[10px] font-semibold tracking-wide">
          <span className="text-zinc-400">{tx("下位", "Lower")}</span>
          <span className="text-zinc-500">{tx("残留", "Stay")}</span>
          <span className="text-emerald-700">{tx("昇格", "Promo")}</span>
        </div>

        <div className="relative h-4 overflow-hidden rounded-full border border-zinc-200/80">
          <div className="absolute inset-y-0 left-0 bg-[#E4E4E7]" style={{ width: `${stayPct}%` }} />
          <div
            className="absolute inset-y-0 bg-[#F4F4F5]"
            style={{ left: `${stayPct}%`, width: `${Math.max(promoPct - stayPct, 0)}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-200/90"
            style={{ left: `${promoPct}%`, width: `${Math.max(100 - promoPct, 0)}%` }}
          />

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
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${clampLabel(stayPct)}%` }}
          >
            {tx("維持ライン", "Stay line")}
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-emerald-700"
            style={{ left: `${clampLabel(promoPct)}%` }}
          >
            {tx("昇格ライン", "Promo line")}
          </span>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
          {progress?.rankBased
            ? tx(
                "票が分かれるまで、順位でゾーン位置を表示しています。",
                "Showing zone by rank until votes separate the scores.",
              )
            : tx(
                "票が増えるとマーカーが右へ動きます。",
                "The marker moves right as you gain votes.",
              )}
        </p>
      </div>

      {idleHint && !progress ? (
        <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">
          {tx(
            "バトルが始まると、順位に合わせて位置が動きます。",
            "Once the battle starts, your marker follows your rank.",
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
      <p className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white">
        {tx("昇格ゾーン内", "Promotion zone")}
        {rank ? ` · #${rank}` : ""}
      </p>
    );
  }
  if (zone === "risk") {
    return (
      <div className="text-right">
        <p className="inline-flex items-center rounded-full bg-zinc-700 px-3 py-1 text-[11px] font-semibold text-white">
          {tx("下位ゾーン", "Lower zone")}
          {rank ? ` · #${rank}` : ""}
        </p>
        {nextLabel ? (
          <p className="mt-1.5 text-[11px] text-zinc-500">
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
      <p className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700">
        {tx("残留ゾーン", "Stay zone")}
        {rank ? ` · #${rank}` : ""}
      </p>
      {nextLabel ? (
        <p className="mt-1.5 text-[11px] text-zinc-500">
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
      className={`absolute top-0 z-[2] h-full w-0.5 -translate-x-1/2 ${className}`}
      style={{ left: `${Math.min(98, Math.max(2, percent))}%` }}
      aria-hidden
    />
  );
}
