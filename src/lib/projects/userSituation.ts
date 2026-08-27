/** プロジェクトの「今の状況」（AIコンテキスト用） */
export type UserSituation = "festival" | "study" | "startup" | "community" | "unclear";

export const USER_SITUATION_OPTIONS: Array<{
  key: UserSituation;
  emoji: string;
  label: string;
  shortLabel: string;
}> = [
  { key: "festival", emoji: "🎪", label: "文化祭・部活・学校イベントのこと", shortLabel: "学校イベント" },
  { key: "study", emoji: "📚", label: "授業・探究・レポートのこと", shortLabel: "授業・探究" },
  { key: "startup", emoji: "🚀", label: "起業・ビジコン・アプリ開発のこと", shortLabel: "起業・開発" },
  { key: "community", emoji: "🌱", label: "地域活動・ボランティアのこと", shortLabel: "地域・ボラ" },
  { key: "unclear", emoji: "🤔", label: "まだよくわからない・なんとなく始めたい", shortLabel: "まだわからない" },
];

const SITUATION_KEYS = new Set<string>(USER_SITUATION_OPTIONS.map((o) => o.key));

export function parseUserSituation(raw: unknown): UserSituation | undefined {
  if (typeof raw !== "string" || !SITUATION_KEYS.has(raw)) return undefined;
  return raw as UserSituation;
}

export function userSituationPromptLabel(situation: UserSituation): string {
  const opt = USER_SITUATION_OPTIONS.find((o) => o.key === situation);
  return opt ? `${opt.emoji} ${opt.label}` : situation;
}

export function userSituationShortLabel(situation: UserSituation | undefined): string | null {
  if (!situation) return null;
  return USER_SITUATION_OPTIONS.find((o) => o.key === situation)?.shortLabel ?? null;
}

/** 旧オンボーディング category からの推定（既存プロジェクト用） */
export function inferUserSituationFromLegacyCategory(category: string | undefined): UserSituation | undefined {
  switch (category) {
    case "event":
      return "festival";
    case "education":
      return "study";
    case "app":
      return "startup";
    case "food":
    case "retail":
      return "startup";
    case "custom":
      return "unclear";
    default:
      return undefined;
  }
}
