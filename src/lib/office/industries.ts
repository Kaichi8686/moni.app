export type OfficeIndustry = "cafe" | "apparel" | "game" | "festival" | "baito" | "sns";

export type IndustryMeta = {
  id: OfficeIndustry;
  labelJa: string;
  blurb: string;
  /** 簡易絵文字アイコン（カード用） */
  icon: string;
};

export const OFFICE_INDUSTRIES: IndustryMeta[] = [
  { id: "cafe", labelJa: "カフェ", blurb: "香りと会話が武器の小さな店", icon: "☕" },
  { id: "apparel", labelJa: "アパレル", blurb: "トレンドをつかむ洋服ブランド", icon: "👕" },
  { id: "game", labelJa: "ゲーム会社", blurb: "面白さ命のインディーチーム", icon: "🎮" },
  { id: "festival", labelJa: "文化祭の模擬店", blurb: "一日限りの本気の出店", icon: "🎪" },
  { id: "baito", labelJa: "バイト先の飲食店", blurb: "ピークタイムを乗り切れ", icon: "🍜" },
  { id: "sns", labelJa: "動画・SNSチーム", blurb: "バズを狙うクリエイター集団", icon: "📱" },
];

export function parseOfficeIndustry(raw: unknown): OfficeIndustry | null {
  const s = String(raw ?? "");
  return OFFICE_INDUSTRIES.some((i) => i.id === s) ? (s as OfficeIndustry) : null;
}

export function industryLabelJa(id: OfficeIndustry | null | undefined): string {
  if (!id) return "会社";
  return OFFICE_INDUSTRIES.find((i) => i.id === id)?.labelJa ?? "会社";
}

export function industryMeta(id: OfficeIndustry | null | undefined): IndustryMeta | null {
  if (!id) return null;
  return OFFICE_INDUSTRIES.find((i) => i.id === id) ?? null;
}
