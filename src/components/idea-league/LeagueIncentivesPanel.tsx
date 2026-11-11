"use client";

import { LEAGUE_TIERS, LEAGUE_TIER_META } from "@/lib/idea-league/tiers";
import type { LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  currentTier: LeagueTier;
  promotions: number;
};

export function LeagueIncentivesPanel({ currentTier, promotions }: Props) {
  const { locale, tx } = useI18n();
  const currentIdx = LEAGUE_TIERS.indexOf(currentTier);

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-bold tracking-tight text-zinc-900">
        {tx("上位リーグのご褒美", "Rewards for climbing")}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        {tx(
          "昇格すると王冠・ハイライト・特別応募枠が増えます。",
          "Promotion unlocks crowns, highlights, and special idea slots.",
        )}
        {promotions > 0
          ? ` ${tx(`これまでの昇格: ${promotions}回`, `Promotions so far: ${promotions}`)}`
          : ""}
      </p>
      <ol className="mt-3 space-y-2">
        {LEAGUE_TIERS.map((tier, i) => {
          const meta = LEAGUE_TIER_META[tier];
          const unlocked = i <= currentIdx;
          const isCurrent = tier === currentTier;
          return (
            <li
              key={tier}
              className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${
                isCurrent ? "bg-[#FFF4E5] ring-2 ring-[#FF9600]/40" : unlocked ? "bg-zinc-50" : "bg-zinc-50/60 opacity-70"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {meta.crown}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold" style={{ color: meta.accent }}>
                  {locale === "en" ? meta.labelEn : meta.labelJa}
                  {isCurrent ? (
                    <span className="ml-2 text-[10px] font-bold text-[#FF9600]">
                      {tx("いまここ", "You are here")}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-600">
                  {locale === "en" ? meta.perkEn : meta.perkJa}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
