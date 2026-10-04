/**
 * 投資AIエンジン（シミュレーター専用）
 *
 * ユーザーが設定した金額・目標・リスクに基づき、
 * 銘柄選定 → 配分 → 定期リバランス／トレンド追随の売買 → レポートまで自動で行う。
 * 実資金・証券会社APIには一切接続しない。
 */

import type {
  AiDiaryEntry,
  AiTrade,
  EquityPoint,
  HoldingSnapshot,
  InvestSimRequest,
  InvestSimResult,
  RiskLevel,
} from "./types";
import { BENCHMARK, pickUniverseForRisk, type UniverseStock } from "./universe";
import {
  barOn,
  commonDates,
  loadPriceSeries,
  synthesizeSeries,
  type PriceSeries,
} from "./marketData";

const FEE_RATE = 0.001;
const SLIPPAGE = 0.0005;

type Pos = { shares: number; avg: number };

function riskParams(risk: RiskLevel) {
  if (risk === "safe") {
    return {
      cashFloor: 0.25,
      maxNameWeight: 0.18,
      rebalanceEvery: 21,
      momentumLookback: 60,
      label: "安全運用",
    };
  }
  if (risk === "growth") {
    return {
      cashFloor: 0.05,
      maxNameWeight: 0.35,
      rebalanceEvery: 10,
      momentumLookback: 40,
      label: "成長重視",
    };
  }
  return {
    cashFloor: 0.12,
    maxNameWeight: 0.25,
    rebalanceEvery: 15,
    momentumLookback: 50,
    label: "バランス運用",
  };
}

function applyBuyPrice(px: number) {
  return px * (1 + SLIPPAGE);
}
function applySellPrice(px: number) {
  return px * (1 - SLIPPAGE);
}

function momentumScore(series: PriceSeries, ticker: string, date: string, lookback: number): number {
  const bars = series[ticker];
  if (!bars?.length) return 0;
  const idx = bars.findIndex((b) => b.date === date);
  if (idx < lookback) return 0;
  const now = bars[idx].close;
  const past = bars[idx - lookback].close;
  if (past <= 0) return 0;
  return now / past - 1;
}

function markEquity(
  cash: number,
  positions: Record<string, Pos>,
  series: PriceSeries,
  date: string,
): number {
  let eq = cash;
  for (const [t, p] of Object.entries(positions)) {
    const bar = barOn(series, t, date);
    if (!bar || p.shares <= 0) continue;
    eq += p.shares * bar.close;
  }
  return eq;
}

function targetWeights(
  picks: UniverseStock[],
  scores: Record<string, number>,
  risk: RiskLevel,
): Record<string, number> {
  const params = riskParams(risk);
  const investable = 1 - params.cashFloor;
  // スコアを非負にして配分。全部同じなら均等。
  const raw = picks.map((p) => ({
    ticker: p.ticker,
    s: Math.max(0.05, 1 + scores[p.ticker] * 3),
  }));
  const sum = raw.reduce((a, b) => a + b.s, 0) || 1;
  const weights: Record<string, number> = {};
  for (const r of raw) {
    weights[r.ticker] = Math.min(params.maxNameWeight, (r.s / sum) * investable);
  }
  // キャップで余った分を再配分（簡易）
  const used = Object.values(weights).reduce((a, b) => a + b, 0);
  if (used < investable) {
    const names = Object.keys(weights);
    const add = (investable - used) / names.length;
    for (const n of names) {
      weights[n] = Math.min(params.maxNameWeight, weights[n] + add);
    }
  }
  return weights;
}

export async function runInvestAiSimulation(req: InvestSimRequest): Promise<InvestSimResult> {
  const initialCapital = Math.max(10_000, Math.floor(req.initialCapital));
  const goalAmount = Math.max(initialCapital, Math.floor(req.goalAmount));
  const years = req.years;
  const risk = req.risk;
  const params = riskParams(risk);
  const picks = pickUniverseForRisk(risk);
  const tickers = [...picks.map((p) => p.ticker), BENCHMARK.ticker];

  const { series, source } = await loadPriceSeries(tickers, years);
  const dates = commonDates(
    Object.fromEntries(
      tickers
        .map((t) => [t, series[t] ?? []] as const)
        .filter(([, v]) => v.length > 0),
    ),
  );

  if (dates.length < 60) {
    return runWithSeries(
      { ...req, initialCapital, goalAmount },
      picks,
      synthesizeSeries(tickers, years),
      "synthetic",
      params,
    );
  }

  return runWithSeries(
    { ...req, initialCapital, goalAmount },
    picks,
    series,
    source,
    params,
  );
}

function runWithSeries(
  req: InvestSimRequest,
  picks: UniverseStock[],
  series: PriceSeries,
  source: "yahoo" | "synthetic",
  params: ReturnType<typeof riskParams>,
): InvestSimResult {
  const nameOf = Object.fromEntries(picks.map((p) => [p.ticker, p.name]));
  nameOf[BENCHMARK.ticker] = BENCHMARK.name;

  const tickers = picks.map((p) => p.ticker);
  const allForDates = Object.fromEntries(
    [...tickers, BENCHMARK.ticker]
      .filter((t) => series[t]?.length)
      .map((t) => [t, series[t]]),
  );
  const dates = commonDates(allForDates);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  let cash = req.initialCapital;
  const positions: Record<string, Pos> = {};
  const trades: AiTrade[] = [];
  const diary: AiDiaryEntry[] = [];
  const equityCurve: EquityPoint[] = [];

  const benchStart = barOn(series, BENCHMARK.ticker, startDate)?.close ?? 1;
  let goalReachedOn: string | null = null;

  diary.push({
    date: startDate,
    title: "運用開始",
    body: `${params.label}モードでスタート。初期資金 ${req.initialCapital.toLocaleString("ja-JP")} 円、目標 ${req.goalAmount.toLocaleString("ja-JP")} 円${
      req.goalLabel ? `（${req.goalLabel}）` : ""
    }。候補銘柄は ${picks.map((p) => p.name).join("・")}。実資金は動かさず、過去相場での仮想運用です。`,
  });

  // 初回: スコアで配分して買い
  const scores0: Record<string, number> = {};
  for (const t of tickers) scores0[t] = momentumScore(series, t, startDate, Math.min(20, dates.length - 1));
  let targets = targetWeights(picks, scores0, req.risk);
  executeRebalance(
    startDate,
    "初回ポートフォリオ構築。目標とリスクに合わせて配分しました。",
    true,
  );

  function executeRebalance(date: string, reason: string, isInitial: boolean) {
    const equity = markEquity(cash, positions, series, date);
    // 売りから
    for (const t of tickers) {
      const bar = barOn(series, t, date);
      if (!bar) continue;
      const pos = positions[t];
      if (!pos?.shares) continue;
      const targetVal = equity * (targets[t] ?? 0);
      const currentVal = pos.shares * bar.close;
      if (currentVal <= targetVal * 1.08) continue;
      const sellVal = currentVal - targetVal;
      const px = applySellPrice(bar.open);
      let shares = Math.floor(sellVal / px);
      shares = Math.min(shares, pos.shares);
      if (shares <= 0) continue;
      const proceeds = px * shares;
      const fee = proceeds * FEE_RATE;
      cash += proceeds - fee;
      pos.shares -= shares;
      if (pos.shares <= 0) delete positions[t];
      trades.push({
        date,
        ticker: t,
        name: nameOf[t] ?? t,
        side: "SELL",
        shares,
        price: px,
        reason,
      });
    }

    const equity2 = markEquity(cash, positions, series, date);
    for (const t of tickers) {
      const bar = barOn(series, t, date);
      if (!bar) continue;
      const targetVal = equity2 * (targets[t] ?? 0);
      const pos = positions[t] ?? { shares: 0, avg: 0 };
      const currentVal = pos.shares * bar.close;
      if (currentVal >= targetVal * 0.92) continue;
      const buyVal = Math.min(targetVal - currentVal, cash * 0.98);
      if (buyVal < 1000) continue;
      const px = applyBuyPrice(bar.open);
      const shares = Math.floor(buyVal / (px * (1 + FEE_RATE)));
      if (shares <= 0) continue;
      const cost = px * shares;
      const fee = cost * FEE_RATE;
      if (cost + fee > cash) continue;
      cash -= cost + fee;
      const newShares = pos.shares + shares;
      const avg = newShares ? (pos.avg * pos.shares + px * shares) / newShares : 0;
      positions[t] = { shares: newShares, avg };
      trades.push({
        date,
        ticker: t,
        name: nameOf[t] ?? t,
        side: "BUY",
        shares,
        price: px,
        reason: isInitial ? reason : reason,
      });
    }
  }

  let lastRebalanceIdx = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const equity = markEquity(cash, positions, series, date);
    const benchPx = barOn(series, BENCHMARK.ticker, date)?.close ?? benchStart;
    const benchEquity = (req.initialCapital * benchPx) / benchStart;
    equityCurve.push({ date, equity, benchmark: benchEquity });

    if (!goalReachedOn && equity >= req.goalAmount) {
      goalReachedOn = date;
      diary.push({
        date,
        title: "目標達成",
        body: `資産が ${Math.round(equity).toLocaleString("ja-JP")} 円に到達。目標 ${req.goalAmount.toLocaleString("ja-JP")} 円を超えました。以降もルールに沿って仮想運用を継続します。`,
      });
    }

    // 定期リバランス + モメンタム更新
    if (i > 0 && i - lastRebalanceIdx >= params.rebalanceEvery) {
      const scores: Record<string, number> = {};
      for (const t of tickers) {
        scores[t] = momentumScore(series, t, date, params.momentumLookback);
      }
      const ranked = [...tickers].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      targets = targetWeights(picks, scores, req.risk);
      const reason = `相場を再点検。勢いのある ${nameOf[best]} を厚め、相対的に弱い ${nameOf[worst]} を抑えめに調整。`;
      executeRebalance(date, reason, false);
      lastRebalanceIdx = i;
      if (diary.length < 14 || i === dates.length - 1) {
        diary.push({
          date,
          title: "AIリバランス",
          body: reason,
        });
      }
    }
  }

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? cash;
  const totalReturn = finalEquity / req.initialCapital - 1;
  const maxDrawdown = calcMaxDd(equityCurve.map((p) => p.equity));
  const benchEnd = equityCurve[equityCurve.length - 1]?.benchmark ?? req.initialCapital;
  const benchmarkReturn = benchEnd / req.initialCapital - 1;

  const finalHoldings: HoldingSnapshot[] = Object.entries(positions)
    .filter(([, p]) => p.shares > 0)
    .map(([ticker, p]) => {
      const px = barOn(series, ticker, endDate)?.close ?? p.avg;
      const value = p.shares * px;
      return {
        ticker,
        name: nameOf[ticker] ?? ticker,
        shares: p.shares,
        value,
        weight: finalEquity > 0 ? value / finalEquity : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const goalReached = Boolean(goalReachedOn) || finalEquity >= req.goalAmount;
  const aiSummary = buildSummary({
    req,
    paramsLabel: params.label,
    finalEquity,
    totalReturn,
    benchmarkReturn,
    goalReached,
    goalReachedOn,
    tradeCount: trades.length,
    maxDrawdown,
    source,
  });

  diary.push({
    date: endDate,
    title: "運用レポート",
    body: aiSummary,
  });

  return {
    request: req,
    startedAt: startDate,
    endedAt: endDate,
    finalEquity,
    totalReturn,
    maxDrawdown,
    goalReached,
    goalReachedOn,
    tradeCount: trades.length,
    trades,
    diary,
    equityCurve,
    finalHoldings,
    cash,
    benchmarkReturn,
    aiSummary,
    dataSource: source,
  };
}

function calcMaxDd(values: number[]): number {
  let peak = values[0] ?? 0;
  let minDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = v / peak - 1;
      if (dd < minDd) minDd = dd;
    }
  }
  return minDd;
}

function buildSummary(args: {
  req: InvestSimRequest;
  paramsLabel: string;
  finalEquity: number;
  totalReturn: number;
  benchmarkReturn: number;
  goalReached: boolean;
  goalReachedOn: string | null;
  tradeCount: number;
  maxDrawdown: number;
  source: string;
}): string {
  const {
    req,
    paramsLabel,
    finalEquity,
    totalReturn,
    benchmarkReturn,
    goalReached,
    goalReachedOn,
    tradeCount,
    maxDrawdown,
  } = args;
  const beat = totalReturn >= benchmarkReturn;
  const goalText = goalReached
    ? goalReachedOn
      ? `${goalReachedOn} に目標達成。`
      : "期間末時点で目標を達成。"
    : `目標 ${req.goalAmount.toLocaleString("ja-JP")} 円には未達。差は ${(req.goalAmount - finalEquity).toLocaleString("ja-JP")} 円。`;

  return [
    `${paramsLabel}で過去 ${req.years} 年を仮想運用した結果、資産は ${Math.round(finalEquity).toLocaleString("ja-JP")} 円（リターン ${(totalReturn * 100).toFixed(1)}%）。`,
    goalText,
    `TOPIX連動ETF（買い持ち）との差は ${((totalReturn - benchmarkReturn) * 100).toFixed(1)} ポイント（AIが${beat ? "上回った" : "下回った"}）。`,
    `最大下落 ${ (maxDrawdown * 100).toFixed(1) }%、売買 ${tradeCount} 回。すべてはシミュレーションです。`,
  ].join(" ");
}
