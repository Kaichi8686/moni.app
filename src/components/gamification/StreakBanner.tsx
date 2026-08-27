"use client";

import { useCallback, useEffect, useState } from "react";
import { badgeLabel, getBadgeDefinition } from "@/lib/gamification/badges";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string | null;
  className?: string;
};

export function StreakBanner({ userId, className = "" }: Props) {
  const { t, locale } = useI18n();
  const [streak, setStreak] = useState(0);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase || !userId) {
      setStreak(0);
      setReady(false);
      return;
    }
    const g = await loadProfileGamification(supabase, userId);
    setStreak(g.activityStreak);
    setReady(g.gamificationReady);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onUpdate = () => void reload();
    window.addEventListener("moni-activity-updated", onUpdate);
    return () => window.removeEventListener("moni-activity-updated", onUpdate);
  }, [reload]);

  if (!userId || !ready || streak < 1) return null;

  const nextBadge = streak < 7 ? getBadgeDefinition("streak_7") : streak < 30 ? getBadgeDefinition("streak_30") : null;

  return (
    <div className={`rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 ${className}`} role="status">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          🔥
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-orange-800">
            {streak}
            {t("streakActive")}
          </p>
          <p className="text-xs text-orange-600">
            {nextBadge
              ? locale === "en"
                ? `${(nextBadge.id === "streak_7" ? 7 : 30) - streak} days to ${nextBadge.icon} ${badgeLabel(nextBadge, "en")}`
                : `あと${(nextBadge.id === "streak_7" ? 7 : 30) - streak}日で${nextBadge.icon} ${badgeLabel(nextBadge, "ja")}`
              : t("streakKeep")}
          </p>
        </div>
      </div>
    </div>
  );
}
