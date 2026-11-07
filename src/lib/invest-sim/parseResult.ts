import { clampNumber, projectCompoundSeries } from "./math";
import { ruleBasedInvestSim } from "./ruleEngine";
import type { InvestSimAllocation, InvestSimInput, InvestSimResult, InvestSimYearRow } from "./types";

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseAllocation(raw: unknown): InvestSimAllocation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const name = asString(r.name);
      const reason = asString(r.reason);
      const percent = asNumber(r.percent);
      if (!name) return null;
      return { name, percent: clampNumber(percent, 0, 100), reason: reason || "—" };
    })
    .filter((x): x is InvestSimAllocation => Boolean(x))
    .slice(0, 8);
}

function parseYearly(raw: unknown, years: number): InvestSimYearRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const year = Math.round(asNumber(r.year));
      const balance = Math.round(asNumber(r.balance));
      const contributed = Math.round(asNumber(r.contributed));
      if (year < 1 || year > years + 5) return null;
      return { year, balance, contributed };
    })
    .filter((x): x is InvestSimYearRow => Boolean(x))
    .slice(0, 60);
}

function stringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => asString(x))
    .filter(Boolean)
    .slice(0, max);
}

export function parseJsonLoose(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/** Normalize AI JSON; fill gaps with deterministic math so charts never break. */
export function normalizeInvestSimResult(
  parsed: Record<string, unknown> | null,
  input: InvestSimInput,
): InvestSimResult | null {
  if (!parsed) return null;

  const title = asString(parsed.title);
  const summary = asString(parsed.summary);
  if (!title || !summary) return null;

  const years = clampNumber(Math.round(input.years), 1, 50);
  const ratePct = clampNumber(asNumber(parsed.assumedAnnualReturnPct, 5), 0.5, 15);
  let yearly = parseYearly(parsed.yearly, years);
  if (yearly.length < Math.min(years, 3)) {
    yearly = projectCompoundSeries({
      principal: input.budgetYen,
      monthly: input.monthlyYen,
      years,
      annualRate: ratePct / 100,
    });
  }

  const last = yearly[yearly.length - 1]!;
  let allocation = parseAllocation(parsed.allocation);
  if (allocation.length < 2) {
    allocation = ruleBasedInvestSim(input).allocation;
  }

  const finalBalance = Math.round(asNumber(parsed.finalBalance, last.balance));
  const totalContributed = Math.round(asNumber(parsed.totalContributed, last.contributed));
  const estimatedGain = Math.round(
    asNumber(parsed.estimatedGain, Math.max(0, finalBalance - totalContributed)),
  );

  return {
    title,
    summary,
    assumedAnnualReturnPct: ratePct,
    allocation,
    yearly,
    finalBalance,
    totalContributed,
    estimatedGain,
    assumptions: stringList(parsed.assumptions, 6),
    risks: stringList(parsed.risks, 6),
    nextSteps: stringList(parsed.nextSteps, 6),
    disclaimer:
      asString(parsed.disclaimer) ||
      "学習用シミュレーションであり、投資助言ではありません。",
  };
}
