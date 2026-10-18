/** 気になる社会問題のプリセットとラベル解決 */

import type { LocaleLabel } from "@/lib/profile/skillsTraits";
import { displayTagLabel, labelForPreset, normalizeTagList, parseStringTagArray } from "@/lib/profile/skillsTraits";

export const SOCIAL_ISSUE_PRESETS: LocaleLabel[] = [
  { ja: "環境・気候変動", en: "Environment & climate" },
  { ja: "貧困・格差", en: "Poverty & inequality" },
  { ja: "教育格差", en: "Education gap" },
  { ja: "ジェンダー平等", en: "Gender equality" },
  { ja: "子どもの権利", en: "Children's rights" },
  { ja: "高齢化・介護", en: "Aging & caregiving" },
  { ja: "メンタルヘルス", en: "Mental health" },
  { ja: "いじめ・ハラスメント", en: "Bullying & harassment" },
  { ja: "食品ロス", en: "Food waste" },
  { ja: "地域コミュニティ", en: "Local community" },
  { ja: "災害・防災", en: "Disaster resilience" },
  { ja: "医療アクセス", en: "Healthcare access" },
  { ja: "LGBTQ+の権利", en: "LGBTQ+ rights" },
  { ja: "難民・移民", en: "Refugees & migration" },
  { ja: "デジタルデバイド", en: "Digital divide" },
  { ja: "働き方・労働", en: "Work & labor" },
  { ja: "動物福祉", en: "Animal welfare" },
  { ja: "平和・紛争", en: "Peace & conflict" },
  { ja: "障がい者支援", en: "Disability inclusion" },
  { ja: "孤独・孤立", en: "Loneliness & isolation" },
];

export const SOCIAL_ISSUES_MAX = 3;

export function socialIssueLabel(stored: string, locale: "ja" | "en"): string {
  return displayTagLabel(stored, SOCIAL_ISSUE_PRESETS, locale);
}

export function socialIssuePresetOptions(locale: "ja" | "en"): Array<{ id: string; label: string }> {
  return SOCIAL_ISSUE_PRESETS.map((p) => ({
    id: p.ja,
    label: labelForPreset(p, locale),
  }));
}

export function parseSocialIssues(raw: unknown): string[] {
  return normalizeTagList(parseStringTagArray(raw), SOCIAL_ISSUES_MAX);
}
