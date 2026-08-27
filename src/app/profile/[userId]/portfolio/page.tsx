"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileActivityGraph } from "@/components/gamification/ProfileActivityGraph";
import { badgeLabel, getBadgeDefinition } from "@/lib/gamification/badges";
import { MONI_TIER_META } from "@/lib/gamification/moniTier";
import { milestoneTypeIcon, milestoneTypeLabel } from "@/lib/gamification/milestones";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { buildPortfolioData, type PortfolioData } from "@/lib/portfolio/buildPortfolioData";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

export default function PortfolioPage() {
  const { t, locale, tx } = useI18n();
  const params = useParams();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const [data, setData] = useState<PortfolioData | null>(null);
  const [activityLog, setActivityLog] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    const [portfolio, gam] = await Promise.all([
      buildPortfolioData(supabase, userId),
      loadProfileGamification(supabase, userId),
    ]);
    setData(portfolio);
    setActivityLog(gam.activityLog);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!supabaseEnabled) {
    return <p className="p-8 text-center text-sm">{tx("Supabase 未接続", "Supabase not connected")}</p>;
  }

  if (loading) {
    return <p className="p-8 text-center text-sm text-gray-500">{tx("読み込み中…", "Loading…")}</p>;
  }
  if (!data?.profile) {
    return <p className="p-8 text-center text-sm text-rose-600">{tx("見つかりません", "Not found")}</p>;
  }

  const tier = MONI_TIER_META[data.tier];
  const tierDesc = locale === "en" ? tier.descriptionEn : tier.description;

  return (
    <div className="min-h-[100dvh] bg-[#fafaf8] pb-12">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/profile/${userId}`} className="text-lg" aria-label={tx("戻る", "Back")}>
            ←
          </Link>
          <h1 className="text-lg font-semibold">
            {data.profile.displayName}
            {t("portfolioTitle")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-2xl">{tier.icon}</p>
          <p className="mt-1 text-sm font-medium text-violet-600">{tier.label}</p>
          <p className="mt-0.5 text-xs text-gray-500">{tierDesc}</p>
          <p className="mt-2 text-sm text-gray-700">{data.profile.bio || "—"}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>
              {tx("投稿", "Posts")} {data.postCount}
            </span>
            <span>
              {tx("連続", "Streak")} {data.activityStreak}
              {locale === "en" ? "d" : "日"}
            </span>
            <span>
              {tx("活動", "Activity")} {data.activityTotal}
              {locale === "en" ? "x" : "回"}
            </span>
          </div>
        </section>

        {data.badges.length > 0 ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{tx("バッジ", "Badges")}</h2>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b) => {
                const def = getBadgeDefinition(b.id);
                const label = def ? badgeLabel(def, locale) : b.label;
                return (
                  <span key={b.id} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
                    {b.icon} {label}
                  </span>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{tx("プロジェクト", "Projects")}</h2>
          {data.projects.length === 0 ? (
            <p className="text-sm text-gray-400">{tx("参加プロジェクトはまだありません", "No projects yet")}</p>
          ) : (
            <ul className="space-y-3">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}/overview`} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <p className="font-semibold">{p.name}</p>
                    {p.description ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.description}</p> : null}
                    <p className="mt-2 text-[11px] text-gray-400">
                      {tx("マイルストーン", "Milestones")} {p.milestoneCount} · {tx("未完了課題", "Open issues")}{" "}
                      {p.openIssueCount}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.milestones.length > 0 ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{tx("マイルストーン", "Milestones")}</h2>
            <ul className="space-y-2">
              {data.milestones.map((m) => (
                <li key={m.id} className="flex gap-2 text-sm">
                  <span>{milestoneTypeIcon(m.type)}</span>
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {milestoneTypeLabel(m.type, locale)} ·{" "}
                      {new Date(m.achievedAt).toLocaleDateString(locale === "en" ? "en-US" : "ja-JP")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ProfileActivityGraph activityLog={activityLog} />
      </main>
    </div>
  );
}
