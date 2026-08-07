"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileActivityGraph } from "@/components/gamification/ProfileActivityGraph";
import { MONI_TIER_META } from "@/lib/gamification/moniTier";
import { milestoneTypeIcon, milestoneTypeLabel } from "@/lib/gamification/milestones";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { buildPortfolioData, type PortfolioData } from "@/lib/portfolio/buildPortfolioData";
import { PortfolioPdfDownload } from "@/components/portfolio/PortfolioPdfDownload";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

export default function PortfolioPage() {
  const { t } = useI18n();
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* ignore */
    }
  }

  if (!supabaseEnabled) {
    return <p className="p-8 text-center text-sm">Supabase 未接続</p>;
  }

  if (loading) return <p className="p-8 text-center text-sm text-gray-500">読み込み中…</p>;
  if (!data?.profile) return <p className="p-8 text-center text-sm text-rose-600">見つかりません</p>;

  const tier = MONI_TIER_META[data.tier];

  return (
    <div className="min-h-[100dvh] bg-[#fafaf8] pb-12">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/profile/${userId}`} className="text-lg">
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
          <p className="mt-2 text-sm text-gray-700">{data.profile.bio || "—"}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>投稿 {data.postCount}</span>
            <span>連続 {data.activityStreak}日</span>
            <span>活動 {data.activityTotal}回</span>
          </div>
        </section>

        {data.badges.length > 0 ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">バッジ</h2>
            <div className="flex flex-wrap gap-2">
              {data.badges.map((b) => (
                <span key={b.id} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">プロジェクト</h2>
          {data.projects.length === 0 ? (
            <p className="text-sm text-gray-400">参加プロジェクトはまだありません</p>
          ) : (
            <ul className="space-y-3">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}/overview`} className="block rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <p className="font-semibold">{p.name}</p>
                    {p.description ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.description}</p> : null}
                    <p className="mt-2 text-[11px] text-gray-400">
                      マイルストーン {p.milestoneCount} · 未完了課題 {p.openIssueCount}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.milestones.length > 0 ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">マイルストーン</h2>
            <ul className="space-y-2">
              {data.milestones.map((m) => (
                <li key={m.id} className="flex gap-2 text-sm">
                  <span>{milestoneTypeIcon(m.type)}</span>
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {milestoneTypeLabel(m.type)} · {new Date(m.achievedAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ProfileActivityGraph activityLog={activityLog} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold"
          >
            {t("portfolioCopy")}
          </button>
          <PortfolioPdfDownload data={data} className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50" />
        </div>
      </main>
    </div>
  );
}
