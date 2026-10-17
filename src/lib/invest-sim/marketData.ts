/**
 * 日次株価取得（シミュレーター専用・発注なし）
 * 直近の実相場を取り、日々の解説に使う。
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

function businessDaysAroundToday(lookback: number, forwardPad = 0): string[] {
  const dates: string[] = [];
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  if (forwardPad) end.setDate(end.getDate() + forwardPad);
  const start = new Date(end);
  start.setDate(start.getDate() - lookback);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function synthesizeRecent(tickers: string[], lookbackDays = 120): PriceSeries {
  const dates = businessDaysAroundToday(lookbackDays);
  const out: PriceSeries = {};
  for (const ticker of tickers) {
    const rnd = mulberry32(hashTicker(ticker) ^ 20261004);
    let price = 800 + (hashTicker(ticker) % 4000);
    if (hashTicker(ticker) % 7 === 0) price = 120 + (hashTicker(ticker) % 200);
    const drift = 0.0002 + (hashTicker(ticker) % 80) / 1_000_000;
    const vol = 0.011 + (hashTicker(ticker) % 40) / 10_000;
    const bars: PriceBar[] = [];
    for (const date of dates) {
      const shock = (rnd() - 0.48) * vol;
      const open = price;
      const close = Math.max(1, price * (1 + drift + shock));
      const high = Math.max(open, close) * (1 + rnd() * 0.006);
      const low = Math.min(open, close) * (1 - rnd() * 0.006);
      bars.push({ date, open, high, low, close });
      price = close;
    }
    out[ticker] = bars;
  }
  return out;
}

async function fetchYahooChart(ticker: string, range: string): Promise<PriceBar[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=${range}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; moni-invest-sim/2.0)",
        Accept: "application/json",
      },
      next: { revalidate: 1800 },
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
      bars.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
      });
    }
    return bars.length > 5 ? cleanBars(bars) : null;
  } catch {
    return null;
  }
}

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

/** 解説・売買判断用に直近〜1年分を取得 */
export async function loadLiveSeries(
  tickers: string[],
): Promise<{ series: PriceSeries; source: "yahoo" | "synthetic" | "mixed" }> {
  const series: PriceSeries = {};
  let hits = 0;
  await Promise.all(
    tickers.map(async (ticker) => {
      const raw = await fetchYahooChart(ticker, "1y");
      if (raw) {
        series[ticker] = raw;
        hits += 1;
      }
    }),
  );

  const missing = tickers.filter((t) => !series[t]?.length);
  if (missing.length) {
    const synth = synthesizeRecent(missing, 260);
    for (const t of missing) series[t] = synth[t];
  }

  if (hits === 0) return { series, source: "synthetic" };
  if (hits < tickers.length) return { series, source: "mixed" };
  return { series, source: "yahoo" };
}

function intersectDates(series: PriceSeries, tickers: string[]): string[] {
  let common: string[] | null = null;
  for (const t of tickers) {
    const dates = (series[t] ?? []).map((b) => b.date);
    if (!dates.length) continue;
    const set = new Set(dates);
    common = common ? common.filter((d) => set.has(d)) : [...set];
  }
  return common ? [...new Set(common)].sort() : [];
}

export function latestCommonDate(series: PriceSeries, tickers: string[]): string | null {
  const dates = intersectDates(series, tickers);
  return dates.at(-1) ?? null;
}

export function barOn(series: PriceSeries, ticker: string, date: string): PriceBar | null {
  return series[ticker]?.find((b) => b.date === date) ?? null;
}

export function prevBar(series: PriceSeries, ticker: string, date: string): PriceBar | null {
  const bars = series[ticker];
  if (!bars?.length) return null;
  const idx = bars.findIndex((b) => b.date === date);
  if (idx <= 0) return null;
  return bars[idx - 1];
}

export function tradingDatesBetween(
  series: PriceSeries,
  tickers: string[],
  afterDate: string | null,
  untilDate: string,
): string[] {
  return intersectDates(series, tickers).filter(
    (d) => (!afterDate || d > afterDate) && d <= untilDate,
  );
}

export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86400000);
}
