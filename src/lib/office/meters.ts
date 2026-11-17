import { METER_KEYS, type MeterKey } from "@/lib/office/scenes";
import type { StrategyKind } from "@/lib/office/types";

export type OfficeMeters = Record<MeterKey, number>;

export const OFFICE_METER_DEFAULT = 50;
export const OFFICE_METER_REGEN_PER_DAY = 5;
export const OFFICE_METER_ALL_HIGH = 70;
export const OFFICE_METER_ALL_HIGH_REVENUE_BONUS = 1.1;

const KIND_FACTOR: Record<Exclude<StrategyKind, "custom">, number> = {
  safe: 0.6,
  standard: 1.0,
  bold: 1.6,
};

export function defaultMeters(): OfficeMeters {
  return {
    customers: OFFICE_METER_DEFAULT,
    morale: OFFICE_METER_DEFAULT,
    reputation: OFFICE_METER_DEFAULT,
    cash: OFFICE_METER_DEFAULT,
  };
}

export function clampMeter(n: number): number {
  if (!Number.isFinite(n)) return OFFICE_METER_DEFAULT;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseMeters(raw: unknown): OfficeMeters | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const out = defaultMeters();
  for (const key of METER_KEYS) {
    if (row[key] == null) return null;
    out[key] = clampMeter(Number(row[key]));
  }
  return out;
}

export function ensureMeters(raw: unknown): OfficeMeters {
  return parseMeters(raw) ?? defaultMeters();
}

/** 最終更新からの経過で50へ1日5ptずつ戻す（参照時計算） */
export function applyMeterDecay(
  meters: OfficeMeters,
  updatedAt: string | Date | null | undefined,
  now: Date = new Date(),
): OfficeMeters {
  if (!updatedAt) return { ...meters };
  const then = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return { ...meters };
  const days = Math.floor(Math.max(0, now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return { ...meters };
  const next = { ...meters };
  for (const key of METER_KEYS) {
    const v = next[key];
    if (v === OFFICE_METER_DEFAULT) continue;
    const delta = Math.min(Math.abs(v - OFFICE_METER_DEFAULT), days * OFFICE_METER_REGEN_PER_DAY);
    next[key] = clampMeter(v > OFFICE_METER_DEFAULT ? v - delta : v + delta);
  }
  return next;
}

export function strategyKindFactor(kind: StrategyKind, scoreTotal: number): number {
  if (kind === "custom") return KIND_FACTOR.standard;
  let f = KIND_FACTOR[kind];
  // bold で低得点のときは下げ幅が増幅
  if (kind === "bold" && scoreTotal < 60) f *= 1.25;
  return f;
}

/**
 * base=(score_total-50)/50×12。meters_at_risk にのみ適用。
 * AIに数値を決めさせないサーバー計算。
 */
export function computeMetersDelta(input: {
  scoreTotal: number;
  strategyKind: StrategyKind;
  metersAtRisk: MeterKey[];
}): Partial<OfficeMeters> {
  const score = Math.max(0, Math.min(100, Math.round(input.scoreTotal)));
  const base = ((score - 50) / 50) * 12;
  const factor = strategyKindFactor(input.strategyKind, score);
  let amount = base * factor;
  // bold かつ低得点：負方向をさらに増幅（すでに factor に反映、ここは保険）
  if (input.strategyKind === "bold" && score < 60 && amount < 0) {
    amount *= 1.1;
  }
  const delta: Partial<OfficeMeters> = {};
  const keys = input.metersAtRisk.filter((k) => (METER_KEYS as readonly string[]).includes(k));
  for (const key of keys.slice(0, 2)) {
    delta[key] = Math.round(amount);
  }
  return delta;
}

export function applyMetersDelta(meters: OfficeMeters, delta: Partial<OfficeMeters>): OfficeMeters {
  const next = { ...meters };
  for (const key of METER_KEYS) {
    if (delta[key] == null) continue;
    next[key] = clampMeter(next[key] + (delta[key] as number));
  }
  return next;
}

export function metersAllHigh(meters: OfficeMeters): boolean {
  return METER_KEYS.every((k) => meters[k] >= OFFICE_METER_ALL_HIGH);
}

/** 売上計算用：全メーター70以上なら ×1.1 */
export function metersRevenueMultiplier(meters: OfficeMeters): number {
  return metersAllHigh(meters) ? OFFICE_METER_ALL_HIGH_REVENUE_BONUS : 1;
}

export function lowestMeterKey(meters: OfficeMeters): MeterKey {
  let best: MeterKey = "customers";
  let v = meters.customers;
  for (const key of METER_KEYS) {
    if (meters[key] < v) {
      v = meters[key];
      best = key;
    }
  }
  return best;
}
