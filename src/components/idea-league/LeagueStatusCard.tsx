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
      className="relative overflow-hidden rounded-[28px] bg-white/95 p-4 shadow-[0_10px_0_rgba(24,24,27,0.07)] ring-1 ring-zinc-200/80 sm:p-5"
      aria-label={label}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-90"
        style={{
          background: `linear-gradient(180deg, ${meta.glow} 0%, transparent 100%)`,
        }}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {phaseLabel ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9600]">
              {phaseLabel}
            </p>
          ) : (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              {tx("アイデアリーグ", "Idea League")}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <LeagueTierBadge tier={tier} size="lg" showLabel={false} animated medal />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-zinc-900 sm:text-2xl">
                {label}
              </h1>
              <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-zinc-600 sm:text-sm">
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

      <div className="relative mt-4 rounded-2xl bg-zinc-50/90 px-3 py-3 ring-1 ring-zinc-200/70 sm:px-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              {tx("今週のポイント", "This week's points")}
            </p>
            <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-zinc-900">
              {progress ? progress.myScore : 0}
              <span className="ml-1 text-sm font-bold text-zinc-500">pt</span>
            </p>
          </div>
          <div className="text-right">
            {progress?.inPromotionZone ? (
              <p className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                {tx("昇格ゾーン内", "In promotion zone")}
                {progress.myRank ? ` · #${progress.myRank}` : ""}
              </p>
            ) : nextLabel ? (
              <p className="text-[12px] font-extrabold text-zinc-800">
                {tx(
                  `昇格まであと ${progress?.pointsToPromotion ?? "—"} pt`,
                  `${progress?.pointsToPromotion ?? "—"} pt to ${nextLabel}`,
                )}
              </p>
            ) : (
              <p className="text-[12px] font-extrabold text-indigo-700">
                {tx("最高リーグ到達", "Top league reached")}
              </p>
            )}
            {nextLabel && !progress?.inPromotionZone ? (
              <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
                {tx(`次: ${nextLabel}`, `Next: ${nextLabel}`)} · TOP {promotionCutoff}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative mt-3 mb-5 h-3.5 overflow-visible rounded-full bg-zinc-200/90">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${progress?.fillPercent ?? 8}%`,
              background: `linear-gradient(90deg, ${meta.bar}, ${meta.accent})`,
              boxShadow: `0 0 12px ${meta.glow}`,
            }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress?.maxScore ?? 100}
            aria-valuenow={progress?.myScore ?? 0}
          />

          {progress ? (
            <>
              <Marker
                percent={progress.promotionMarkerPercent}
                tone="promote"
                label={tx("昇格", "Up")}
              />
              <Marker
                percent={progress.stayMarkerPercent}
                tone="stay"
                label={tx("維持", "Stay")}
              />
            </>
          ) : (
            <Marker percent={72} tone="promote" label={tx("昇格", "Up")} />
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {tx("昇格ライン", "Promotion line")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden />
            {tx("維持ライン", "Safety line")}
          </span>
        </div>

        {idleHint && !progress ? (
          <p className="mt-2 text-[11px] font-medium text-zinc-500">
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

function Marker({
  percent,
  tone,
  label,
}: {
  percent: number;
  tone: "promote" | "stay";
  label: string;
}) {
  const clamped = Math.min(98, Math.max(2, percent));
  const color = tone === "promote" ? "bg-emerald-500" : "bg-zinc-400";
  return (
    <div
      className="pointer-events-none absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${clamped}%` }}
    >
      <div className={`h-5 w-1 rounded-full ${color} shadow-sm ring-2 ring-white`} />
      <span
        className={`absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ${
          tone === "promote" ? "bg-emerald-600" : "bg-zinc-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
