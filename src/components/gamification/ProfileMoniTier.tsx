"use client";

import Link from "next/link";
import { MONI_TIER_META, type MoniTier } from "@/lib/gamification/moniTier";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  tier: MoniTier;
  userId: string;
};

export function ProfileMoniTier({ tier, userId }: Props) {
  const { locale, tx } = useI18n();
  const meta = MONI_TIER_META[tier];
  const description = locale === "en" ? meta.descriptionEn : meta.description;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-800" title={description}>
        <span aria-hidden>{meta.icon}</span>
        {meta.label}
      </span>
      <Link href={`/profile/${userId}/portfolio`} className="text-xs font-medium text-violet-600 hover:underline">
        {tx("ポートフォリオ →", "Portfolio →")}
      </Link>
    </div>
  );
}
