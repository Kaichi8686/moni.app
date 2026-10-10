/**
 * ライブ投資実験エンジン
 *
 * - 開始: 今日から期限までの実験セッションを作る
 * - 更新: まだ反映していない営業日があれば、その日の株価を見て
 *   動きを解説し、ゴール逆算で売買する（1日ずつ積み上がる）
 *
 * 過去何年分を一気に回して結果を出すバックテストではない。
 */

import { pickUniverseForRisk, BENCHMARK, type UniverseStock } from "./universe";
import {
  addDaysYmd,
  barOn,
  daysBetween,
  latestCommonDate,
  loadLiveSeries,
  prevBar,
  todayYmd,
  tradingDatesBetween,
  type PriceSeries,
} from "./marketData";
import type {
  DayBriefing,
  ExperimentSession,
  ExperimentSetup,
  MarketMoveNote,
  Position,
  RiskLevel,
  TickResponse,
} from "./types";

const FEE = 0.001;
const SLIP = 0.0005;

function riskParams(risk: RiskLevel) {
  if (risk === "safe") return { cashFloor: 0.3, maxWeight: 0.2, label: "安全" };
  if (risk === "growth") return { cashFloor: 0.05, maxWeight: 0.38, label: "成長" };
  return { cashFloor: 0.12, maxWeight: 0.28, label: "バランス" };
}

function yen(n: number) {
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

function markEquity(cash: number, positions: Position[], series: PriceSeries, date: string) {
  let eq = cash;
  for (const p of positions) {
    const bar = barOn(series, p.ticker, date);
    if (!bar) continue;
    eq += p.shares * bar.close;
  }
  return eq;
}

function changePct(series: PriceSeries, ticker: string, date: string): number | null {
  const cur = barOn(series, ticker, date);
  const prev = prevBar(series, ticker, date);
  if (!cur || !prev || prev.close <= 0) return null;
  return cur.close / prev.close - 1;
}

function describeMove(name: string, pct: number): string {
  const abs = Math.abs(pct) * 100;
  if (pct >= 0.03) return `${name}は大きく上昇（+${abs.toFixed(1)}%）。買い気の強い一日。`;
  if (pct >= 0.01) return `${name}は堅調（+${abs.toFixed(1)}%）。`;
  if (pct > 0.002) return `${name}は小幅高（+${abs.toFixed(1)}%）。`;
  if (pct > -0.002) return `${name}はほぼ横ばい（${(pct * 100).toFixed(1)}%）。`;
  if (pct > -0.01) return `${name}は小幅安（${(pct * 100).toFixed(1)}%）。`;
  if (pct > -0.03) return `${name}は軟調（${(pct * 100).toFixed(1)}%）。`;
  return `${name}は大きく下落（${(pct * 100).toFixed(1)}%）。慎重に見る局面。`;
}

function paceComment(
  equity: number,
  goal: number,
  startDate: string,
  endDate: string,
  asOf: string,
): string {
  const total = Math.max(1, daysBetween(startDate, endDate));
  const left = Math.max(0, daysBetween(asOf, endDate));
  const elapsed = Math.min(total, Math.max(0, total - left));
  const progress = equity / goal;
  const timeProgress = elapsed / total;
  const need = goal / Math.max(equity, 1) - 1;

  if (equity >= goal) {
    return `目標 ${yen(goal)} をすでに超えています。残り ${left} 日は守りを意識しつつ、成果を維持します。`;
  }
  if (left <= 0) {
    return `期限到来。最終資産 ${yen(equity)} / 目標 ${yen(goal)}。`;
  }
  if (progress + 0.03 >= timeProgress) {
    return `残り ${left} 日。今のペースなら期限までの到達が見えます（必要あと ${yen(goal - equity)}、およそ ${(need * 100).toFixed(1)}%）。`;
  }
  if (progress + 0.12 < timeProgress) {
    return `残り ${left} 日。目標ペースより遅れ気味です。ルールの範囲で攻め寄りに調整します（必要あと ${yen(goal - equity)}）。`;
  }
  return `残り ${left} 日。もう少し加速が欲しい局面。必要リターンは約 ${(need * 100).toFixed(1)}%。`;
}

function targetWeights(
  picks: UniverseStock[],
  scores: Record<string, number>,
  risk: RiskLevel,
  behindPace: boolean,
): Record<string, number> {
  const base = riskParams(risk);
  const cashFloor = behindPace ? Math.max(0.02, base.cashFloor * 0.5) : base.cashFloor;
  const maxWeight = behindPace ? Math.min(0.45, base.maxWeight + 0.05) : base.maxWeight;
  const investable = 1 - cashFloor;
  const raw = picks.map((p) => ({
    ticker: p.ticker,
    s: Math.max(0.08, 1 + (scores[p.ticker] ?? 0) * 4),
  }));
  const sum = raw.reduce((a, b) => a + b.s, 0) || 1;
  const weights: Record<string, number> = {};
  for (const r of raw) {
    weights[r.ticker] = Math.min(maxWeight, (r.s / sum) * investable);
  }
  return weights;
}

function momentum(series: PriceSeries, ticker: string, date: string, lookback: number): number {
  const bars = series[ticker];
  if (!bars) return 0;
  const idx = bars.findIndex((b) => b.date === date);
  if (idx < lookback) return 0;
  const now = bars[idx].close;
  const past = bars[idx - lookback].close;
  if (past <= 0) return 0;
  return now / past - 1;
}

function rebalance(
  session: ExperimentSession,
  series: PriceSeries,
  date: string,
  picks: UniverseStock[],
  behindPace: boolean,
  reasonPrefix: string,
): string[] {
  const actions: string[] = [];
  const risk = session.setup.risk;
  const scores: Record<string, number> = {};
  for (const p of picks) scores[p.ticker] = momentum(series, p.ticker, date, 20);
  const weights = targetWeights(picks, scores, risk, behindPace);
  const nameOf = Object.fromEntries(picks.map((p) => [p.ticker, p.name]));

  let cash = session.cash;
  let positions = session.positions.map((p) => ({ ...p }));

  const equity = markEquity(cash, positions, series, date);

  // 売り
  for (const pos of [...positions]) {
    const bar = barOn(series, pos.ticker, date);
    if (!bar) continue;
    const target = equity * (weights[pos.ticker] ?? 0);
    const cur = pos.shares * bar.close;
    if (cur <= target * 1.1) continue;
    const px = bar.open * (1 - SLIP);
    let shares = Math.floor((cur - target) / px);
    shares = Math.min(shares, pos.shares);
    if (shares <= 0) continue;
    const proceeds = px * shares;
    cash += proceeds * (1 - FEE);
    pos.shares -= shares;
    session.trades.push({
      date,
      ticker: pos.ticker,
      name: pos.name,
      side: "SELL",
      shares,
      price: px,
      reason: `${reasonPrefix}${pos.name}を一部利確・縮小`,
    });
    actions.push(`${pos.name}を ${shares} 株売却`);
  }
  positions = positions.filter((p) => p.shares > 0);

  const equity2 = markEquity(cash, positions, series, date);

  // 買い
  for (const p of picks) {
    const bar = barOn(series, p.ticker, date);
    if (!bar) continue;
    const target = equity2 * (weights[p.ticker] ?? 0);
    const pos = positions.find((x) => x.ticker === p.ticker);
    const cur = (pos?.shares ?? 0) * bar.close;
    if (cur >= target * 0.9) continue;
    const px = bar.open * (1 + SLIP);
    const budget = Math.min(target - cur, cash * 0.95);
    if (budget < 3000) continue;
    const shares = Math.floor(budget / (px * (1 + FEE)));
    if (shares <= 0) continue;
    const cost = px * shares * (1 + FEE);
    if (cost > cash) continue;
    cash -= cost;
    if (pos) {
      const newShares = pos.shares + shares;
      pos.avgPrice = (pos.avgPrice * pos.shares + px * shares) / newShares;
      pos.shares = newShares;
    } else {
      positions.push({ ticker: p.ticker, name: nameOf[p.ticker] ?? p.name, shares, avgPrice: px });
    }
    session.trades.push({
      date,
      ticker: p.ticker,
      name: nameOf[p.ticker] ?? p.name,
      side: "BUY",
      shares,
      price: px,
      reason: `${reasonPrefix}${nameOf[p.ticker]}を積み増し`,
    });
    actions.push(`${nameOf[p.ticker]}を ${shares} 株購入`);
  }

  session.cash = cash;
  session.positions = positions;
  return actions;
}

function buildMoves(
  series: PriceSeries,
  date: string,
  picks: UniverseStock[],
  heldTickers: Set<string>,
): MarketMoveNote[] {
  const notes: MarketMoveNote[] = [];
  for (const p of picks) {
    const pct = changePct(series, p.ticker, date);
    const bar = barOn(series, p.ticker, date);
    if (pct == null || !bar) continue;
    // 保有 or 大きく動いた銘柄を優先
    if (!heldTickers.has(p.ticker) && Math.abs(pct) < 0.008) continue;
    notes.push({
      ticker: p.ticker,
      name: p.name,
      changePct: pct,
      close: bar.close,
      note: describeMove(p.name, pct),
    });
  }
  notes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  return notes.slice(0, 6);
}

function processOneDay(
  session: ExperimentSession,
  series: PriceSeries,
  date: string,
  picks: UniverseStock[],
  isFirst: boolean,
): DayBriefing {
  const held = new Set(session.positions.map((p) => p.ticker));
  const moves = buildMoves(series, date, picks, held);
  const equityBefore = markEquity(session.cash, session.positions, series, date);

  // 残り日数は「カレンダー上の今日→期限」で統一（相場日付と混ぜない）
  const totalDays = Math.max(1, session.setup.durationDays);
  const calendarToday = todayYmd();
  const left = Math.max(0, daysBetween(calendarToday, session.endDate));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(session.startDate, calendarToday)));
  const timeProgress = elapsed / totalDays;
  const moneyProgress = equityBefore / session.setup.goalAmount;
  const behindPace = moneyProgress + 0.05 < timeProgress && equityBefore < session.setup.goalAmount;

  let actions: string[] = [];
  if (isFirst || behindPace || elapsed % 3 === 0 || session.positions.length === 0) {
    const prefix = isFirst ? "実験開始に伴い、" : behindPace ? "ペース遅れのため、" : "定例点検で、";
    actions = rebalance(session, series, date, picks, behindPace || isFirst, prefix);
  }

  const equity = markEquity(session.cash, session.positions, series, date);
  session.equityCurve.push({ date, equity, goal: session.setup.goalAmount });

  if (!session.goalReachedOn && equity >= session.setup.goalAmount) {
    session.goalReachedOn = date;
    session.status = "goal_reached";
  }

  const avgMove =
    moves.length > 0 ? moves.reduce((a, m) => a + m.changePct, 0) / moves.length : 0;
  let marketSummary: string;
  if (isFirst) {
    marketSummary = `今日から ${session.setup.durationDays} 日間の投資実験を開始します。初期資金 ${yen(session.setup.initialCapital)}、目標 ${yen(session.setup.goalAmount)}${session.setup.goalLabel ? `（${session.setup.goalLabel}）` : ""}。リスクは「${riskParams(session.setup.risk).label}」。実資金は使いません。`;
  } else if (avgMove > 0.008) {
    marketSummary = `きょうの監視銘柄は全体として強含み。平均で約 +${(avgMove * 100).toFixed(1)}%。上げの勢いがある銘柄を中心に見ています。`;
  } else if (avgMove < -0.008) {
    marketSummary = `きょうは調整色が強め。平均で約 ${(avgMove * 100).toFixed(1)}%。無理な追いはせず、目標までの残り日数と相談しながら動かします。`;
  } else {
    marketSummary = `大きな方向感は薄い一日（平均 ${(avgMove * 100).toFixed(1)}%）。コツコツ点検して、期限までの軌道修正を続けます。`;
  }

  const aiAction =
    actions.length > 0
      ? `AIの今日の行動: ${actions.join(" / ")}。`
      : "AIの今日の行動: 新規の売買は見送り。保有を維持して様子見。";

  const briefing: DayBriefing = {
    date,
    title: isFirst ? "実験スタート" : `${date} の相場を反映`,
    marketSummary,
    moves,
    aiAction,
    paceComment: paceComment(equity, session.setup.goalAmount, session.startDate, session.endDate, date),
    equity,
    cash: session.cash,
    daysRemaining: left,
  };

  session.briefings.push(briefing);
  session.lastProcessedDate = date;
  session.updatedAt = new Date().toISOString();

  if (date >= session.endDate && session.status === "active") {
    session.status = equity >= session.setup.goalAmount ? "goal_reached" : "finished";
  }

  return briefing;
}

export async function startExperiment(setup: ExperimentSetup): Promise<TickResponse> {
  const initialCapital = Math.max(10_000, Math.floor(setup.initialCapital));
  const goalAmount = Math.max(initialCapital, Math.floor(setup.goalAmount));
  const startDate = todayYmd();
  const endDate = addDaysYmd(startDate, setup.durationDays);
  const picks = pickUniverseForRisk(setup.risk);
  const tickers = [...picks.map((p) => p.ticker), BENCHMARK.ticker];

  const { series, source } = await loadLiveSeries(tickers);
  const latest = latestCommonDate(series, picks.map((p) => p.ticker));

  const session: ExperimentSession = {
    id: crypto.randomUUID(),
    version: 2,
    setup: {
      ...setup,
      initialCapital,
      goalAmount,
      goalLabel: setup.goalLabel?.slice(0, 40),
    },
    startDate,
    endDate,
    status: "active",
    cash: initialCapital,
    positions: [],
    trades: [],
    briefings: [],
    equityCurve: [],
    lastProcessedDate: null,
    goalReachedOn: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dataSource: source,
  };

  const newBriefings: DayBriefing[] = [];
  if (latest) {
    // 開始日時点で取得できる最新営業日を「初日」として反映
    newBriefings.push(processOneDay(session, series, latest, picks, true));
  }

  return {
    session,
    newBriefings,
    message: latest
      ? `実験を開始し、最新営業日（${latest}）の相場を反映しました。明日以降も「今日の相場を追う」で日々更新できます。`
      : "実験を開始しましたが、相場データを取得できませんでした。しばらくして更新してください。",
  };
}

export async function tickExperiment(session: ExperimentSession): Promise<TickResponse> {
  if (session.status === "finished" || session.status === "stopped") {
    return {
      session,
      newBriefings: [],
      message: "この実験は終了しています。新しい条件でやり直してください。",
    };
  }

  const picks = pickUniverseForRisk(session.setup.risk);
  const tickers = [...picks.map((p) => p.ticker), BENCHMARK.ticker];
  const { series, source } = await loadLiveSeries(tickers);
  session.dataSource = source;

  const today = todayYmd();
  const until = today < session.endDate ? today : session.endDate;
  const dates = tradingDatesBetween(
    series,
    picks.map((p) => p.ticker),
    session.lastProcessedDate,
    until,
  );

  const newBriefings: DayBriefing[] = [];

  if (!dates.length) {
    // 期限超過チェック
    if (today >= session.endDate && session.status === "active") {
      session.status =
        markEquity(
          session.cash,
          session.positions,
          series,
          session.lastProcessedDate ?? until,
        ) >= session.setup.goalAmount
          ? "goal_reached"
          : "finished";
      session.updatedAt = new Date().toISOString();
      return {
        session,
        newBriefings: [],
        message: `新しい営業日はありません。実験期間は ${session.endDate} までです（現状: ${session.status}）。`,
      };
    }
    return {
      session,
      newBriefings: [],
      message: session.lastProcessedDate
        ? `すでに ${session.lastProcessedDate} まで反映済みです。次の営業日の終値が出たら、また「今日の相場を追う」を押してください。`
        : "反映できる営業日がまだありません。市場が開いたあとでもう一度どうぞ。",
    };
  }

  // ユーザー体験: 「結果がすぐ全部出る」のを避けるため、
  // 1回の更新では最大1営業日だけ進める（見逃し分は翌日また追う）
  const next = dates[0];
  const isFirst = session.briefings.length === 0;
  newBriefings.push(processOneDay(session, series, next, picks, isFirst));

  const moreWaiting = dates.length - 1;
  const status = session.status as ExperimentSession["status"];
  let message = `${next} の相場を反映し、AIが解説と売買判断を更新しました。`;
  if (moreWaiting > 0) {
    message += `（未反映の営業日があと ${moreWaiting} 日分あります。もう一度「今日の相場を追う」で続けられます）`;
  } else if (status === "goal_reached") {
    message += " 目標金額に到達しました。";
  } else if (status === "finished") {
    message += " 実験期間が終了しました。";
  } else {
    message += " 次の営業日以降も、ここに戻って追い続けてください。";
  }

  return { session, newBriefings, message };
}
