/** 興味のある分野のプリセットとラベル解決 */

import type { LocaleLabel } from "@/lib/profile/skillsTraits";
import { displayTagLabel, labelForPreset, normalizeTagList, parseStringTagArray } from "@/lib/profile/skillsTraits";

export const INTEREST_FIELD_PRESETS: LocaleLabel[] = [
  { ja: "AI・機械学習", en: "AI & machine learning" },
  { ja: "宇宙・航空", en: "Space & aviation" },
  { ja: "音楽", en: "Music" },
  { ja: "映像・映画", en: "Film & video" },
  { ja: "ゲーム", en: "Games" },
  { ja: "スポーツ", en: "Sports" },
  { ja: "ファッション", en: "Fashion" },
  { ja: "食・料理", en: "Food & cooking" },
  { ja: "アート・デザイン", en: "Art & design" },
  { ja: "起業・ビジネス", en: "Entrepreneurship" },
  { ja: "科学・研究", en: "Science & research" },
  { ja: "医療・ヘルスケア", en: "Medicine & health" },
  { ja: "教育", en: "Education" },
  { ja: "環境・サステナビリティ", en: "Environment & sustainability" },
  { ja: "建築・都市", en: "Architecture & cities" },
  { ja: "法律・政治", en: "Law & politics" },
  { ja: "国際関係", en: "International affairs" },
  { ja: "メディア・ジャーナリズム", en: "Media & journalism" },
  { ja: "心理学", en: "Psychology" },
  { ja: "ものづくり・ハードウェア", en: "Making & hardware" },
];

export const INTEREST_FIELDS_MAX = 3;

export function interestFieldLabel(stored: string, locale: "ja" | "en"): string {
  return displayTagLabel(stored, INTEREST_FIELD_PRESETS, locale);
}

export function interestFieldPresetOptions(locale: "ja" | "en"): Array<{ id: string; label: string }> {
  return INTEREST_FIELD_PRESETS.map((p) => ({
    id: p.ja,
    label: labelForPreset(p, locale),
  }));
}

export function parseInterestFields(raw: unknown): string[] {
  return normalizeTagList(parseStringTagArray(raw), INTEREST_FIELDS_MAX);
}
