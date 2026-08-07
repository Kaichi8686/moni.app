export const QNA_CATEGORIES = [
  { id: "howto", label: "進め方" },
  { id: "tech", label: "技術的な質問" },
  { id: "idea", label: "アイデア相談" },
  { id: "other", label: "その他" },
] as const;

export type QnaCategoryId = (typeof QNA_CATEGORIES)[number]["id"];

export function isQnaCategoryId(value: string): value is QnaCategoryId {
  return QNA_CATEGORIES.some((c) => c.id === value);
}

export function qnaCategoryLabel(id: string): string {
  return QNA_CATEGORIES.find((c) => c.id === id)?.label ?? "その他";
}

export const QNA_CATEGORY_DEFAULT: QnaCategoryId = "howto";
