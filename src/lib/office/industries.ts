export type OfficeIndustry =
  | "food"
  | "fashion"
  | "tech"
  | "event"
  | "shop"
  | "media"
  | "learn"
  | "health"
  | "community";

export type IndustryMeta = {
  id: OfficeIndustry;
  labelJa: string;
  blurb: string;
  /** 簡易絵文字アイコン（カード用） */
  icon: string;
};

/** 旧・具体業種 → 新しい「〇〇系」 */
const LEGACY_INDUSTRY_MAP: Record<string, OfficeIndustry> = {
  cafe: "food",
  baito: "food",
  apparel: "fashion",
  game: "tech",
  festival: "event",
  sns: "media",
};

export const OFFICE_INDUSTRIES: IndustryMeta[] = [
  { id: "food", labelJa: "飲食系", blurb: "カフェ・食堂・キッチンなど", icon: "🍽️" },
  { id: "fashion", labelJa: "ファッション系", blurb: "服・雑貨・ブランドなど", icon: "👗" },
  { id: "tech", labelJa: "ものづくり・テック系", blurb: "アプリ・ゲーム・ガジェットなど", icon: "🛠️" },
  { id: "event", labelJa: "イベント系", blurb: "文化祭・ポップアップ・催しなど", icon: "🎉" },
  { id: "shop", labelJa: "お店・サービス系", blurb: "店舗オペ・接客など", icon: "🏪" },
  { id: "media", labelJa: "発信・クリエイティブ系", blurb: "動画・SNS・制作など", icon: "🎬" },
  { id: "learn", labelJa: "学び・スクール系", blurb: "塾・教室・講座など", icon: "📚" },
  { id: "health", labelJa: "スポーツ・健康系", blurb: "ジム・部活・ウェルネスなど", icon: "🏃" },
  { id: "community", labelJa: "地域・コミュニティ系", blurb: "町おこし・サークルなど", icon: "🏘️" },
];

export function parseOfficeIndustry(raw: unknown): OfficeIndustry | null {
  const s = String(raw ?? "");
  if (OFFICE_INDUSTRIES.some((i) => i.id === s)) return s as OfficeIndustry;
  return LEGACY_INDUSTRY_MAP[s] ?? null;
}

export function industryLabelJa(id: OfficeIndustry | null | undefined): string {
  if (!id) return "会社";
  return OFFICE_INDUSTRIES.find((i) => i.id === id)?.labelJa ?? "会社";
}

export function industryMeta(id: OfficeIndustry | null | undefined): IndustryMeta | null {
  if (!id) return null;
  const parsed = parseOfficeIndustry(id);
  if (!parsed) return null;
  return OFFICE_INDUSTRIES.find((i) => i.id === parsed) ?? null;
}
