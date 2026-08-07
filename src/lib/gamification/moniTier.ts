import type { EarnedBadge } from "@/lib/gamification/badges";
import type { UserMilestone } from "@/lib/gamification/milestones";

export type MoniTier = "explorer" | "builder" | "achiever" | "champion" | "legend";

export const MONI_TIER_META: Record<
  MoniTier,
  { label: string; icon: string; description: string }
> = {
  explorer: { label: "moni Explorer", icon: "📚", description: "登録完了" },
  builder: { label: "moni Builder", icon: "🚀", description: "プロジェクト進行中" },
  achiever: { label: "moni Achiever", icon: "💰", description: "実績3件以上" },
  champion: { label: "moni Champion", icon: "🏆", description: "顕著な成果（運営認定）" },
  legend: { label: "moni Legend", icon: "🌟", description: "継続的成功" },
};

export function computeMoniTier(input: {
  projectCount: number;
  milestoneCount: number;
  streak: number;
  badges: EarnedBadge[];
  manualTier?: string | null;
}): MoniTier {
  const manual = input.manualTier?.trim();
  if (manual === "champion" || manual === "legend") return manual;
  if (input.streak >= 100 || input.badges.some((b) => b.id === "fundraised")) return "legend";
  if (input.milestoneCount >= 3) return "achiever";
  if (input.projectCount >= 1) return "builder";
  return "explorer";
}
