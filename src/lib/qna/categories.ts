export const QNA_CATEGORIES = [
  { id: "howto", label: "進め方", labelEn: "How-to" },
  { id: "tech", label: "技術的な質問", labelEn: "Technical" },
  { id: "idea", label: "アイデア相談", labelEn: "Idea discussion" },
  { id: "other", label: "その他", labelEn: "Other" },
] as const;

export type QnaCategoryId = (typeof QNA_CATEGORIES)[number]["id"];

export function isQnaCategoryId(value: string): value is QnaCategoryId {
  return QNA_CATEGORIES.some((c) => c.id === value);
}

export function qnaCategoryLabel(id: string, locale?: "ja" | "en"): string {
  const cat = QNA_CATEGORIES.find((c) => c.id === id);
  if (!cat) return locale === "en" ? "Other" : "その他";
  return locale === "en" ? cat.labelEn : cat.label;
}

export const QNA_CATEGORY_DEFAULT: QnaCategoryId = "howto";
