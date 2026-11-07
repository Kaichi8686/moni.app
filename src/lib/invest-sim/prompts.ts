import type { InvestSimInput, InvestSimMethodId } from "./types";
import { INVEST_SIM_METHOD_OPTIONS } from "./types";

export const INVEST_SIM_SYSTEM = `あなたは「moni」の学習用・投資シミュレーションコーチです。
高校生〜大学生〜若手向けに、入力された予算・年数・方法の限定だけを根拠に、教育目的の投資シミュレーションを作ります。

## 最重要ルール
- これは学習用シミュレーション。特定銘柄の売買推奨・「必ず儲かる」断定は禁止
- 入力の「方法の限定」を必ず守る（例: NISAのみ、暗号資産なし）
- 日本語。です・ます調。先生ぶらず、短く具体的に
- 利回りは現実的な範囲（だいたい年3〜8%想定）。ハイリスク妄想はしない
- 税金・手数料はざっくり前提に触れてもよいが、詳細な税務アドバイスはしない
- 数字は円（整数）。percent は合計がおおよそ100になる配分

## 出力（厳守・JSONのみ・他の文章禁止）
{
  "title": "戦略の短い名前（12〜24字）",
  "summary": "2〜4文。何をするシミュレーションか・なぜその方針か",
  "assumedAnnualReturnPct": 5.5,
  "allocation": [
    { "name": "資産クラス名", "percent": 60, "reason": "なぜこの割合か1文" }
  ],
  "yearly": [
    { "year": 1, "balance": 1100000, "contributed": 1000000 }
  ],
  "finalBalance": 1500000,
  "totalContributed": 1000000,
  "estimatedGain": 500000,
  "assumptions": ["前提1", "前提2"],
  "risks": ["リスク・注意1", "注意2"],
  "nextSteps": ["今日できる小さな一歩", "調べるとよいこと"],
  "disclaimer": "学習用シミュレーションであり、投資助言ではありません。"
}

yearly は year=1 から入力年数まで毎年1行。複利＋積立のイメージで一貫した数字にする。`;

function methodLabel(id: InvestSimMethodId): string {
  return INVEST_SIM_METHOD_OPTIONS.find((o) => o.id === id)?.labelJa ?? id;
}

export function buildInvestSimUserPayload(input: InvestSimInput): string {
  const methods =
    input.methods.length > 0
      ? input.methods.map((id) => `- ${methodLabel(id)}`).join("\n")
      : "- （プリセット指定なし）";
  const custom = input.customLimits.trim() || "（なし）";

  return [
    "次の条件で投資シミュレーションを作ってください。",
    "",
    `初期予算（円）: ${Math.round(input.budgetYen)}`,
    `毎月の積立（円）: ${Math.round(input.monthlyYen)}`,
    `かける年数: ${Math.round(input.years)}`,
    "",
    "方法の限定（プリセット）:",
    methods,
    "",
    `追加の限定（自由記述）: ${custom}`,
    "",
    "上記だけを根拠に JSON で返してください。",
  ].join("\n");
}

export const INVEST_SIM_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    assumedAnnualReturnPct: { type: "number" },
    allocation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          percent: { type: "number" },
          reason: { type: "string" },
        },
        required: ["name", "percent", "reason"],
      },
    },
    yearly: {
      type: "array",
      items: {
        type: "object",
        properties: {
          year: { type: "number" },
          balance: { type: "number" },
          contributed: { type: "number" },
        },
        required: ["year", "balance", "contributed"],
      },
    },
    finalBalance: { type: "number" },
    totalContributed: { type: "number" },
    estimatedGain: { type: "number" },
    assumptions: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
  },
  required: [
    "title",
    "summary",
    "assumedAnnualReturnPct",
    "allocation",
    "yearly",
    "finalBalance",
    "totalContributed",
    "estimatedGain",
    "assumptions",
    "risks",
    "nextSteps",
    "disclaimer",
  ],
};
