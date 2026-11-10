"use client";

import { LEAGUE_TIER_META, type LeagueTierMeta } from "@/lib/idea-league/tiers";
import type { LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  tier: LeagueTier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  /** @deprecated Prefer `flat` — metallic medal plate (legacy) */
  medal?: boolean;
  /** Solid flat circle — use on status cards */
  flat?: boolean;
};

const FLAT_SURFACE: Record<LeagueTier, string> = {
  bronze: "bg-amber-50 text-amber-800 border-amber-200/80",
  silver: "bg-zinc-100 text-zinc-700 border-zinc-200",
  gold: "bg-amber-50 text-amber-700 border-amber-200/80",
  platinum: "bg-slate-100 text-slate-700 border-slate-200",
  diamond: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
};

export function LeagueTierBadge({
  tier,
  size = "md",
  showLabel = true,
  animated,
  medal,
  flat,
}: Props) {
  const { locale } = useI18n();
  const meta: LeagueTierMeta = LEAGUE_TIER_META[tier];
  const useFlat = flat || medal;
  const sizeCls = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-xl";
  const flatBox =
    size === "lg" ? "h-14 w-14 sm:h-16 sm:w-16" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const label = locale === "en" ? meta.labelEn : meta.labelJa;

  if (useFlat) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-full border ${flatBox} ${FLAT_SURFACE[tier]} ${sizeCls}`}
          aria-hidden
        >
          <span className={animated ? "inline-block animate-[league-crown-bob_2.4s_ease-in-out_infinite]" : undefined}>
            {meta.crown}
          </span>
        </span>
        {showLabel ? (
          <span className="text-sm font-semibold tracking-tight text-zinc-800">{label}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`relative inline-flex items-center justify-center ${sizeCls}`} aria-hidden>
        <span className={animated ? "inline-block animate-[league-crown-bob_2.4s_ease-in-out_infinite]" : undefined}>
          {meta.crown}
        </span>
      </span>
      {showLabel ? (
        <span className="text-sm font-semibold tracking-tight" style={{ color: meta.accent }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
