"use client";

import { LEAGUE_TIER_META, type LeagueTierMeta } from "@/lib/idea-league/tiers";
import type { LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  tier: LeagueTier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
};

export function LeagueTierBadge({ tier, size = "md", showLabel = true, animated }: Props) {
  const { locale } = useI18n();
  const meta: LeagueTierMeta = LEAGUE_TIER_META[tier];
  const sizeCls =
    size === "lg" ? "text-4xl" : size === "sm" ? "text-base" : "text-2xl";
  const label = locale === "en" ? meta.labelEn : meta.labelJa;

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`relative inline-flex items-center justify-center ${sizeCls}`}
        style={{ filter: `drop-shadow(0 0 10px ${meta.glow})` }}
        aria-hidden
      >
        <span className={animated ? "inline-block animate-[league-crown-bob_2.4s_ease-in-out_infinite]" : undefined}>
          {meta.crown}
        </span>
        {tier === "diamond" || tier === "platinum" ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-full opacity-70"
            style={{
              boxShadow: `0 0 18px 4px ${meta.glow}`,
              animation: animated ? "league-glow-pulse 2.8s ease-in-out infinite" : undefined,
            }}
          />
        ) : null}
      </span>
      {showLabel ? (
        <span className="text-sm font-extrabold tracking-tight" style={{ color: meta.accent }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
