/** 投資AIシミュレーターの型定義（実資金・証券APIは使わない） */

export type RiskLevel = "safe" | "balanced" | "growth";

export type InvestSimRequest = {
  /** 初期資金（円） */
  initialCapital: number;
  /** 目標金額（円） */
  goalAmount: number;
  /** リスク許容度 */
  risk: RiskLevel;
  /** さかのぼってシミュレートする年数 */
  years: 1 | 2 | 3;
  /** 任意のメモ（例: 留学費用） */
  goalLabel?: string;
};

export type AiTrade = {
  date: string;
  ticker: string;
  name: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  reason: string;
};

export type AiDiaryEntry = {
  date: string;
  title: string;
  body: string;
};

export type EquityPoint = {
  date: string;
  equity: number;
  benchmark: number;
};

export type HoldingSnapshot = {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  weight: number;
};

export type InvestSimResult = {
  request: InvestSimRequest;
  startedAt: string;
  endedAt: string;
  finalEquity: number;
  totalReturn: number;
  maxDrawdown: number;
  goalReached: boolean;
  goalReachedOn: string | null;
  tradeCount: number;
  trades: AiTrade[];
  diary: AiDiaryEntry[];
  equityCurve: EquityPoint[];
  finalHoldings: HoldingSnapshot[];
  cash: number;
  benchmarkReturn: number;
  aiSummary: string;
  dataSource: "yahoo" | "synthetic";
};
