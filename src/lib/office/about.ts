import {
  OFFICE_ABOUT_MAX,
  OFFICE_ABOUT_MIN,
} from "@/lib/office/constants";
import type { OfficeIndustry } from "@/lib/office/industries";

export function normalizeCompanyAbout(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OFFICE_ABOUT_MAX);
}

export function parseCompanyAbout(raw: unknown): string | null {
  const s = normalizeCompanyAbout(raw);
  if (s.length < OFFICE_ABOUT_MIN) return null;
  return s;
}

/** オフィス演出用に説明文から系統をゆるく推定（事件生成には使わない） */
export function guessIndustryFromAbout(about: string | null | undefined): OfficeIndustry | null {
  const s = String(about ?? "");
  if (!s) return null;
  const rules: Array<[OfficeIndustry, RegExp]> = [
    ["food", /カフェ|食堂|飲食|キッチン|弁当|フード|レストラン|居酒屋|スイーツ|パン|喫茶|デリ/],
    ["fashion", /服|ファッション|アパレル|ブランド|雑貨|コスメ|アクセ|靴/],
    ["tech", /アプリ|ゲーム|テック|ソフト|ガジェット|AI|プログラム|開発|ものづくり|IT/],
    ["event", /イベント|文化祭|フェス|催し|ライブ|ポップアップ|学園祭/],
    ["shop", /お店|店舗|接客|サロン|サービス|販売|小売/],
    ["media", /動画|SNS|発信|クリエイ|配信|YouTube|制作|デザイン|イラスト/],
    ["learn", /塾|スクール|教室|講座|学び|勉強|教育|レッスン/],
    ["health", /ジム|スポーツ|健康|部活|フィットネス|ウェルネス|トレーニング/],
    ["community", /地域|コミュニティ|町おこし|サークル|ボランティア|まちづくり/],
  ];
  for (const [id, re] of rules) {
    if (re.test(s)) return id;
  }
  return null;
}
