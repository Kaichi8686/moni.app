/** Personal investment simulator — inputs & AI result shapes */

export type InvestSimMethodId =
  | "nisa_only"
  | "tsumitate_only"
  | "index_only"
  | "us_or_global"
  | "jp_only"
  | "no_crypto"
  | "no_individual"
  | "low_risk";

export const INVEST_SIM_METHOD_OPTIONS: Array<{
  id: InvestSimMethodId;
  labelJa: string;
  labelEn: string;
}> = [
  { id: "nisa_only", labelJa: "NISAのみ", labelEn: "NISA only" },
  { id: "tsumitate_only", labelJa: "積立のみ", labelEn: "DCA / monthly only" },
  { id: "index_only", labelJa: "インデックスのみ", labelEn: "Index funds only" },
  { id: "us_or_global", labelJa: "米国・全世界中心", labelEn: "US / global focus" },
  { id: "jp_only", labelJa: "国内のみ", labelEn: "Japan only" },
  { id: "no_crypto", labelJa: "暗号資産なし", labelEn: "No crypto" },
  { id: "no_individual", labelJa: "個別株なし", labelEn: "No individual stocks" },
  { id: "low_risk", labelJa: "リスク低め", labelEn: "Lower risk" },
];

export type InvestSimInput = {
  /** Lump-sum / starting capital in JPY */
  budgetYen: number;
  /** Investment horizon in years */
  years: number;
  /** Optional monthly contribution in JPY */
  monthlyYen: number;
  /** Preset method limits */
  methods: InvestSimMethodId[];
  /** Free-text extra limits */
  customLimits: string;
};

export type InvestSimAllocation = {
  name: string;
  percent: number;
  reason: string;
};

export type InvestSimYearRow = {
  year: number;
  balance: number;
  contributed: number;
};

export type InvestSimResult = {
  title: string;
  summary: string;
  /** Assumed annual return as percent, e.g. 5.5 */
  assumedAnnualReturnPct: number;
  allocation: InvestSimAllocation[];
  yearly: InvestSimYearRow[];
  finalBalance: number;
  totalContributed: number;
  estimatedGain: number;
  assumptions: string[];
  risks: string[];
  nextSteps: string[];
  disclaimer: string;
};

export type InvestSimApiResponse =
  | { ok: true; mode: "gemini" | "demo"; result: InvestSimResult }
  | { ok: false; error: string };
