/** Deterministic compound growth helpers for demo / offline fallback */

export function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function projectCompoundSeries(params: {
  principal: number;
  monthly: number;
  years: number;
  annualRate: number;
}): Array<{ year: number; balance: number; contributed: number }> {
  const years = Math.max(1, Math.round(params.years));
  const rMonthly = params.annualRate / 12;
  let balance = Math.max(0, params.principal);
  let contributed = Math.max(0, params.principal);
  const rows: Array<{ year: number; balance: number; contributed: number }> = [];

  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + rMonthly) + Math.max(0, params.monthly);
      contributed += Math.max(0, params.monthly);
    }
    rows.push({
      year: y,
      balance: Math.round(balance),
      contributed: Math.round(contributed),
    });
  }
  return rows;
}

export function formatYen(n: number, locale: "ja" | "en" = "ja"): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(Math.round(n));
  } catch {
    return `¥${Math.round(n).toLocaleString("ja-JP")}`;
  }
}
