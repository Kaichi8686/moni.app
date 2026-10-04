/** 投資AIが選ぶ候補銘柄（東証・Yahoo形式） */

export type UniverseStock = {
  ticker: string;
  name: string;
  /** 安全寄り 0 〜 成長寄り 1 */
  growthBias: number;
  sector: string;
};

export const BENCHMARK = {
  ticker: "1306.T",
  name: "TOPIX連動ETF",
} as const;

export const UNIVERSE: UniverseStock[] = [
  { ticker: "7203.T", name: "トヨタ自動車", growthBias: 0.35, sector: "自動車" },
  { ticker: "6758.T", name: "ソニーグループ", growthBias: 0.55, sector: "電機" },
  { ticker: "9984.T", name: "ソフトバンクG", growthBias: 0.9, sector: "通信・投資" },
  { ticker: "8306.T", name: "三菱UFJ", growthBias: 0.3, sector: "金融" },
  { ticker: "9432.T", name: "NTT", growthBias: 0.25, sector: "通信" },
  { ticker: "6861.T", name: "キーエンス", growthBias: 0.65, sector: "精密機器" },
  { ticker: "6098.T", name: "リクルート", growthBias: 0.7, sector: "サービス" },
  { ticker: "4063.T", name: "信越化学", growthBias: 0.5, sector: "化学" },
  { ticker: "8035.T", name: "東京エレクトロン", growthBias: 0.85, sector: "半導体" },
  { ticker: "4502.T", name: "武田薬品", growthBias: 0.4, sector: "医薬" },
];

export function pickUniverseForRisk(risk: "safe" | "balanced" | "growth"): UniverseStock[] {
  const sorted = [...UNIVERSE].sort((a, b) => a.growthBias - b.growthBias);
  if (risk === "safe") {
    return sorted.slice(0, 5);
  }
  if (risk === "growth") {
    return sorted.slice(-5).reverse();
  }
  // balanced: 真ん中寄り + 両端を少し
  return [
    sorted[1],
    sorted[3],
    sorted[5],
    sorted[7],
    sorted[8],
  ].filter(Boolean);
}
