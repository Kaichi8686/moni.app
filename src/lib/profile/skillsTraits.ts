/** 特技・性格のプリセットと JSON 配列パース */

export type LocaleLabel = { ja: string; en: string };

export const SKILL_PRESETS: LocaleLabel[] = [
  { ja: "企画立案", en: "Planning" },
  { ja: "デザイン", en: "Design" },
  { ja: "プログラミング", en: "Programming" },
  { ja: "マーケティング", en: "Marketing" },
  { ja: "発表・プレゼン", en: "Presenting" },
  { ja: "リサーチ・分析", en: "Research & analysis" },
  { ja: "営業・交渉", en: "Sales & negotiation" },
  { ja: "動画編集", en: "Video editing" },
  { ja: "ライティング", en: "Writing" },
  { ja: "SNS運用", en: "Social media" },
  { ja: "会計・資金管理", en: "Finance" },
  { ja: "ものづくり", en: "Making / craft" },
];

export const TRAIT_PRESETS: LocaleLabel[] = [
  { ja: "リーダー気質", en: "Leader type" },
  { ja: "コツコツ型", en: "Steady & consistent" },
  { ja: "アイデア出しが得意", en: "Idea generator" },
  { ja: "聞き役・調整役", en: "Listener / facilitator" },
  { ja: "慎重派", en: "Careful thinker" },
  { ja: "行動力がある", en: "Action-oriented" },
  { ja: "好奇心旺盛", en: "Curious" },
  { ja: "チームワーク重視", en: "Team player" },
  { ja: "細かい作業が得意", en: "Detail-oriented" },
  { ja: "ポジティブ", en: "Positive" },
];

export function labelForPreset(item: LocaleLabel, locale: "ja" | "en"): string {
  return locale === "en" ? item.en : item.ja;
}

export function displayTagLabel(
  stored: string,
  presets: LocaleLabel[],
  locale: "ja" | "en",
): string {
  const hit = presets.find((p) => p.ja === stored || p.en === stored);
  if (hit) return labelForPreset(hit, locale);
  return stored;
}

export function presetLabels(presets: LocaleLabel[], locale: "ja" | "en"): string[] {
  return presets.map((p) => labelForPreset(p, locale));
}

/** DB jsonb / unknown → 正規化した string[] */
export function parseStringTagArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function normalizeTagList(tags: string[], max = 24): string[] {
  return parseStringTagArray(tags).slice(0, max);
}
