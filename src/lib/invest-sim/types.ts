/** 投資実験シミュレーター（実資金・証券APIなし）
 *
 * 過去データを一気に回して結果を出すのではなく、
 * 開始日から期限まで「実際の相場」を日々追いながら AI がゴールを目指す。
 */

export type RiskLevel = "safe" | "balanced" | "growth";

/** 実験の長さ（今日からの日数） */
export type ExperimentDurationDays = 30 | 90 | 180 | 365;

export type ExperimentSetup = {
  initialCapital: number;
  goalAmount: number;
  risk: RiskLevel;
  /** 今日から何日後をゴール期限にするか */
  durationDays: ExperimentDurationDays;
  goalLabel?: string;
};

export type Position = {
  ticker: string;
  name: string;
  shares: number;
  avgPrice: number;
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

export type MarketMoveNote = {
  ticker: string;
  name: string;
  changePct: number;
  close: number;
  note: string;
};

export type DayBriefing = {
  date: string;
  /** その日の見出し */
  title: string;
  /** 相場全体の解説 */
  marketSummary: string;
  /** 個別銘柄の動き */
  moves: MarketMoveNote[];
  /** AIが今日取った行動の説明 */
  aiAction: string;
  /** ゴールまでのペースコメント */
  paceComment: string;
  equity: number;
  cash: number;
  daysRemaining: number;
};

export type EquityPoint = {
  date: string;
  equity: number;
  goal: number;
};

export type ExperimentStatus = "active" | "goal_reached" | "finished" | "stopped";

export type ExperimentSession = {
  id: string;
  version: 2;
  setup: ExperimentSetup;
  /** YYYY-MM-DD 実験開始日（ローカル日付） */
  startDate: string;
  /** YYYY-MM-DD ゴール期限 */
  endDate: string;
  status: ExperimentStatus;
  cash: number;
  positions: Position[];
  trades: AiTrade[];
  briefings: DayBriefing[];
  equityCurve: EquityPoint[];
  /** 最後に反映した営業日 */
  lastProcessedDate: string | null;
  goalReachedOn: string | null;
  createdAt: string;
  updatedAt: string;
  dataSource: "yahoo" | "synthetic" | "mixed";
};

export type TickResponse = {
  session: ExperimentSession;
  /** 今回新しく追加された日次ブリーフィング（0件なら新しい営業日なし） */
  newBriefings: DayBriefing[];
  message: string;
};
