export type EarnedBadge = {
  id: string;
  earned_at: string;
};

export type BadgeDefinition = {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_post",
    label: "初投稿",
    labelEn: "First post",
    icon: "✍️",
    description: "はじめて投稿した",
    descriptionEn: "You shared your first post",
  },
  {
    id: "first_project",
    label: "プロジェクト開始",
    labelEn: "Started a project",
    icon: "🚀",
    description: "プロジェクトを始めた",
    descriptionEn: "You started a project",
  },
  {
    id: "team_player",
    label: "チームメンバー",
    labelEn: "Team member",
    icon: "🤝",
    description: "2つ以上のプロジェクトに参加",
    descriptionEn: "Joined 2 or more projects",
  },
  {
    id: "first_sale",
    label: "初売上",
    labelEn: "First sale",
    icon: "💰",
    description: "初めての売上を記録",
    descriptionEn: "Recorded your first sale",
  },
  {
    id: "pitch_done",
    label: "ピッチ登壇",
    labelEn: "Pitch stage",
    icon: "🎤",
    description: "ピッチを公開した",
    descriptionEn: "Published a pitch",
  },
  {
    id: "streak_7",
    label: "7日連続",
    labelEn: "7-day streak",
    icon: "🔥",
    description: "7日連続でアクティブ",
    descriptionEn: "Active 7 days in a row",
  },
  {
    id: "streak_30",
    label: "30日連続",
    labelEn: "30-day streak",
    icon: "⚡",
    description: "30日連続でアクティブ",
    descriptionEn: "Active 30 days in a row",
  },
  {
    id: "fundraised",
    label: "資金調達",
    labelEn: "Fundraising",
    icon: "💎",
    description: "資金調達を記録",
    descriptionEn: "Recorded fundraising",
  },
];

const BADGE_MAP = new Map(BADGE_DEFINITIONS.map((b) => [b.id, b]));

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_MAP.get(id);
}

export function badgeLabel(def: BadgeDefinition, locale: "ja" | "en"): string {
  return locale === "en" ? def.labelEn : def.label;
}

export function badgeDescription(def: BadgeDefinition, locale: "ja" | "en"): string {
  return locale === "en" ? def.descriptionEn : def.description;
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
