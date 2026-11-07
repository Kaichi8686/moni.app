"use client";

import { LeagueCountdown } from "@/components/idea-league/LeagueCountdown";
import { LeagueIncentivesPanel } from "@/components/idea-league/LeagueIncentivesPanel";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { upcomingSaturdayStart } from "@/lib/idea-league/calendar";
import { LEAGUE_TIER_META } from "@/lib/idea-league/tiers";
import type { LeagueProfileState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  profile: LeagueProfileState;
};

export function LeagueWaitingScreen({ profile }: Props) {
  const { locale, tx } = useI18n();
  const nextSat = upcomingSaturdayStart();
  const meta = LEAGUE_TIER_META[profile.tier];

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4">
      <div
        className="overflow-hidden rounded-[28px] p-5 text-white shadow-[0_12px_0_rgba(15,23,42,0.35)]"
        style={{
          background: `linear-gradient(145deg, #0f172a 0%, ${meta.accent} 120%)`,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
          {tx("アイデアリーグ", "Idea League")}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <LeagueTierBadge tier={profile.tier} size="lg" showLabel={false} animated />
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {locale === "en" ? meta.labelEn : meta.labelJa}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              {locale === "en" ? meta.descriptionEn : meta.descriptionJa}
            </p>
          </div>
        </div>
        {profile.highlight ? (
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
            {tx("ハイライト表示オン — 注目されやすい状態です", "Highlight on — you're more discoverable")}
          </p>
        ) : null}
      </div>

      <LeagueCountdown target={nextSat} label={tx("次のリーグ戦まで", "Until next league battle")} />

      <div className="rounded-3xl bg-white/90 p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80">
        <h2 className="text-sm font-black text-zinc-900">{tx("開催ルール", "How it works")}</h2>
        <ul className="mt-2 space-y-1.5 text-sm font-medium text-zinc-600">
          <li>・{tx("毎週土曜日のみ開催（Asia/Tokyo）", "Saturdays only (Asia/Tokyo)")}</li>
          <li>・{tx("同じリーグレベルのグループで共通お題", "Shared prompt within your league tier")}</li>
          <li>・{tx("相互投票の結果、上位3名が昇格", "Peer votes — top 3 promote")}</li>
        </ul>
      </div>

      <LeagueIncentivesPanel currentTier={profile.tier} promotions={profile.promotions} />

      <section className="rounded-3xl bg-white/90 p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80">
        <h2 className="text-sm font-black text-zinc-900">{tx("過去の結果", "Past results")}</h2>
        {profile.history.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-zinc-500">
            {tx("まだ本番の結果がありません。次の土曜が初戦です。", "No battle results yet — next Saturday is your first.")}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {profile.history.slice(0, 6).map((h) => (
              <li
                key={`${h.weekKey}-${h.endedAt}`}
                className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-zinc-900">{h.promptTitle}</p>
                  <p className="text-[11px] font-semibold text-zinc-500">
                    {h.weekKey} · {h.tier}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums text-zinc-900">
                    #{h.rank ?? "—"}
                  </p>
                  <p
                    className={`text-[11px] font-bold ${
                      h.resultStatus === "promoted" ? "text-emerald-600" : "text-zinc-500"
                    }`}
                  >
                    {h.resultStatus === "promoted"
                      ? tx("昇格", "Promoted")
                      : tx("残留", "Stayed")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
