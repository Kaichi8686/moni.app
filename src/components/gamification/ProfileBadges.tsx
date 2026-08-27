"use client";

import { BadgeRow } from "@/components/profile/BadgeRow";
import type { EarnedBadge } from "@/lib/gamification/badges";

type Props = {
  badges: EarnedBadge[];
};

/** @deprecated Use BadgeRow — kept for imports */
export function ProfileBadges({ badges }: Props) {
  return <BadgeRow badges={badges} />;
}
