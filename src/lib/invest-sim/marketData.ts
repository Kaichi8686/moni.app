/**
 * 日次株価の取得。
 * まず Yahoo Finance Chart API を試し、失敗したら合成データにフォールバック。
 * （実発注はしない。シミュレーター専用）
 */

export type PriceBar = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PriceSeries = Record<string, PriceBar[]>;

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashTicker(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0;
  return h || 1;
}

/** 営業日っぽい日付列（土日スキップ） */
function businessDaysBack(years: number): string[] {
  const dates: string[] = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function synthesizeSeries(tickers: string[], years: number): PriceSeries {
  const dates = businessDaysBack(years);
  const out: PriceSeries = {};
  for (const ticker of tickers) {
    const rnd = mulberry32(hashTicker(ticker) ^ (years * 997));
    // 銘柄ごとの初期価格・ドリフト・ボラ
    let price = 800 + (hashTicker(ticker) % 4000);
    if (ticker.endsWith(".T") && hashTicker(ticker) % 7 === 0) price = 120 + (hashTicker(ticker) % 200);
    const drift = 0.00015 + (hashTicker(ticker) % 100) / 1_000_000;
    const vol = 0.012 + (hashTicker(ticker) % 50) / 10_000;
    const bars: PriceBar[] = [];
    for (const date of dates) {
      const shock = (rnd() - 0.48) * vol;
      const open = price;
      const close = Math.max(1, price * (1 + drift + shock));
      const high = Math.max(open, close) * (1 + rnd() * 0.008);
      const low = Math.min(open, close) * (1 - rnd() * 0.008);
      bars.push({ date, open, high, low, close });
      price = close;
    }
    out[ticker] = bars;
  }
  return out;
}

async function fetchYahooChart(ticker: string, years: number): Promise<PriceBar[] | null> {
  const range = years <= 1 ? "1y" : years <= 2 ? "2y" : "5y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=${range}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; moni-invest-sim/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    const ts = result?.timestamp;
    const q = result?.indicators?.quote?.[0];
    if (!ts?.length || !q?.close?.length) return null;

    const bars: PriceBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = q.close[i];
      const open = q.open?.[i] ?? close;
      const high = q.high?.[i] ?? close;
      const low = q.low?.[i] ?? close;
      if (close == null || open == null || high == null || low == null) continue;
      if (close <= 0 || open <= 0) continue;
      const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
      bars.push({ date, open, high, low, close });
    }
    return bars.length > 40 ? bars : null;
  } catch {
    return null;
  }
}

/** 明らかなスパイク（誤データ）を落とす */
function cleanBars(bars: PriceBar[]): PriceBar[] {
  if (bars.length < 5) return bars;
  const closes = bars.map((b) => b.close);
  return bars.filter((b, i) => {
    const window = closes.slice(Math.max(0, i - 5), Math.min(closes.length, i + 6));
    const sorted = [...window].sort((a, c) => a - c);
    const median = sorted[Math.floor(sorted.length / 2)] || b.close;
    if (median <= 0) return true;
    return Math.abs(b.close - median) / median <= 0.5;
  });
}

export async function loadPriceSeries(
  tickers: string[],
  years: number,
): Promise<{ series: PriceSeries; source: "yahoo" | "synthetic" }> {
  const series: PriceSeries = {};
  let yahooHits = 0;

  await Promise.all(
    tickers.map(async (ticker) => {
      const raw = await fetchYahooChart(ticker, years);
      if (raw) {
        series[ticker] = cleanBars(raw);
        yahooHits += 1;
      }
    }),
  );

  // 半分以上取れたら Yahoo、足りない銘柄だけ合成で埋める
  if (yahooHits >= Math.ceil(tickers.length * 0.5)) {
    const missing = tickers.filter((t) => !series[t]?.length);
    if (missing.length) {
      const synth = synthesizeSeries(missing, years);
      for (const t of missing) series[t] = synth[t];
    }
    return { series, source: "yahoo" };
  }

  return { series: synthesizeSeries(tickers, years), source: "synthetic" };
}

/** 全銘柄の共通営業日 */
export function commonDates(series: PriceSeries): string[] {
  const keys = Object.keys(series);
  if (!keys.length) return [];
  let set = new Set(series[keys[0]].map((b) => b.date));
  for (const k of keys.slice(1)) {
    const next = new Set(series[k].map((b) => b.date));
    set = new Set([...set].filter((d) => next.has(d)));
  }
  return [...set].sort();
}

export function barOn(series: PriceSeries, ticker: string, date: string): PriceBar | null {
  const bars = series[ticker];
  if (!bars) return null;
  return bars.find((b) => b.date === date) ?? null;
}
