export type EarnedBadge = {
  id: string;
  earned_at: string;
};

export type BadgeDefinition = {
  id: string;
  label: string;
  icon: string;
  description: string;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: "first_post", label: "初投稿", icon: "✍️", description: "はじめて投稿した" },
  { id: "first_project", label: "プロジェクト開始", icon: "🚀", description: "プロジェクトを始めた" },
  { id: "team_player", label: "チームメンバー", icon: "🤝", description: "2つ以上のプロジェクトに参加" },
  { id: "first_sale", label: "初売上", icon: "💰", description: "初めての売上を記録" },
  { id: "pitch_done", label: "ピッチ登壇", icon: "🎤", description: "ピッチを公開した" },
  { id: "streak_7", label: "7日連続", icon: "🔥", description: "7日連続でアクティブ" },
  { id: "streak_30", label: "30日連続", icon: "⚡", description: "30日連続でアクティブ" },
  { id: "fundraised", label: "資金調達", icon: "💎", description: "資金調達を記録" },
];

const BADGE_MAP = new Map(BADGE_DEFINITIONS.map((b) => [b.id, b]));

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_MAP.get(id);
}

export function mergeEarnedBadges(existing: EarnedBadge[], toAdd: string[]): EarnedBadge[] {
  const have = new Set(existing.map((b) => b.id));
  const now = new Date().toISOString();
  const next = [...existing];
  for (const id of toAdd) {
    if (!have.has(id)) {
      have.add(id);
      next.push({ id, earned_at: now });
    }
  }
  return next;
}

export type BadgeStats = {
  postCount: number;
  projectCount: number;
  teamProjectCount: number;
  pitchCount: number;
  activityStreak: number;
  milestoneTypes: Set<string>;
};

export function badgesToGrant(stats: BadgeStats): string[] {
  const grant: string[] = [];
  if (stats.postCount >= 1) grant.push("first_post");
  if (stats.projectCount >= 1) grant.push("first_project");
  if (stats.teamProjectCount >= 2) grant.push("team_player");
  if (stats.pitchCount >= 1) grant.push("pitch_done");
  if (stats.activityStreak >= 7) grant.push("streak_7");
  if (stats.activityStreak >= 30) grant.push("streak_30");
  if (stats.milestoneTypes.has("first_sale")) grant.push("first_sale");
  if (stats.milestoneTypes.has("funding")) grant.push("fundraised");
  return grant;
}
