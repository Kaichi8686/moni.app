"use client";

import { useId } from "react";
import { LEAGUE_TIER_META, type LeagueTierMeta } from "@/lib/idea-league/tiers";
import type { LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  tier: LeagueTier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  /** Metallic medal plate behind the crown for hero cards */
  medal?: boolean;
};

export function LeagueTierBadge({
  tier,
  size = "md",
  showLabel = true,
  animated,
  medal,
}: Props) {
  const { locale } = useI18n();
  const uid = useId().replace(/:/g, "");
  const meta: LeagueTierMeta = LEAGUE_TIER_META[tier];
  const sizeCls = size === "lg" ? "text-4xl" : size === "sm" ? "text-base" : "text-2xl";
  const medalBox =
    size === "lg" ? "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const label = locale === "en" ? meta.labelEn : meta.labelJa;
  const gradId = `league-medal-${tier}-${uid}`;
  const shineId = `league-medal-shine-${tier}-${uid}`;

  const crown = (
    <span
      className={`relative inline-flex items-center justify-center ${sizeCls}`}
      style={{ filter: medal ? undefined : `drop-shadow(0 0 10px ${meta.glow})` }}
      aria-hidden
    >
      <span className={animated ? "inline-block animate-[league-crown-bob_2.4s_ease-in-out_infinite]" : undefined}>
        {meta.crown}
      </span>
      {!medal && (tier === "diamond" || tier === "platinum") ? (
        <span
          className="pointer-events-none absolute inset-0 rounded-full opacity-70"
          style={{
            boxShadow: `0 0 18px 4px ${meta.glow}`,
            animation: animated ? "league-glow-pulse 2.8s ease-in-out infinite" : undefined,
          }}
        />
      ) : null}
    </span>
  );

  return (
    <div className="inline-flex items-center gap-2">
      {medal ? (
        <span
          className={`relative inline-flex shrink-0 items-center justify-center ${medalBox}`}
          aria-hidden
        >
          <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full drop-shadow-md" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
                <stop offset="45%" stopColor={meta.bar} />
                <stop offset="100%" stopColor={meta.accent} />
              </linearGradient>
              <radialGradient id={shineId} cx="30%" cy="25%" r="65%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="55%" stopColor="#fff" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="40" r="36" fill={`url(#${gradId})`} />
            <circle cx="40" cy="40" r="36" fill={`url(#${shineId})`} />
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2.5"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke={meta.accent}
              strokeOpacity="0.35"
              strokeWidth="2"
            />
          </svg>
          <span className="relative z-[1] drop-shadow-sm">{crown}</span>
          {(tier === "diamond" || tier === "platinum" || tier === "gold") && animated ? (
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 22px 2px ${meta.glow}`,
                animation: "league-glow-pulse 2.8s ease-in-out infinite",
              }}
            />
          ) : null}
        </span>
      ) : (
        crown
      )}
      {showLabel ? (
        <span className="text-sm font-extrabold tracking-tight" style={{ color: meta.accent }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
