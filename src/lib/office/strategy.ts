import { clampScore } from "@/lib/office/scoring";
import type {
  IncidentStrategy,
  IncidentTargetInternal,
  StrategyKind,
  TargetFit,
} from "@/lib/office/types";

export const STRATEGY_KINDS: StrategyKind[] = ["safe", "standard", "bold"];
export const TARGET_FITS: TargetFit[] = ["good", "ok", "mismatch"];

export function lerp(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return a + (b - a) * x;
}

/** 作戦 kind と総合点から倍率（サーバー固定。AIに決めさせない） */
export function strategyMultiplier(kind: StrategyKind, scoreTotal: number): number {
  const s = clampScore(scoreTotal);
  if (kind === "safe") return lerp(0.9, 1.1, s / 100);
  if (kind === "standard" || kind === "custom") return lerp(0.8, 1.3, s / 100);
  if (s >= 60) return lerp(1.2, 1.8, (s - 60) / 40);
  return lerp(0.5, 0.9, s / 59);
}

export function originalBonus(strategyId: string, scoreTotal: number): number {
  return strategyId === "custom" && clampScore(scoreTotal) >= 70 ? 0.1 : 0;
}

export function stripTargetFit(
  targets: IncidentTargetInternal[],
): Array<{ id: string; label: string }> {
  return targets.map(({ id, label }) => ({ id, label }));
}

export function parseStrategies(raw: unknown): IncidentStrategy[] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const out: IncidentStrategy[] = [];
  const kinds = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const kind = String(row.kind ?? "").trim() as StrategyKind;
    const title = String(row.title ?? "").trim().slice(0, 15);
    const summary = String(row.summary ?? "").trim().slice(0, 40);
    if (!id || !title || !summary) return null;
    if (!STRATEGY_KINDS.includes(kind) && kind !== "custom") return null;
    if (kind === "custom") return null;
    if (kinds.has(kind)) return null;
    kinds.add(kind);
    out.push({ id, kind, title, summary });
  }
  if (kinds.size !== 3) return null;
  if (!STRATEGY_KINDS.every((k) => kinds.has(k))) return null;
  return out;
}

export function parseTargets(raw: unknown): IncidentTargetInternal[] | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const out: IncidentTargetInternal[] = [];
  let mismatch = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim().slice(0, 12);
    const fit = String(row.fit ?? "").trim() as TargetFit;
    if (!id || !label) return null;
    if (!TARGET_FITS.includes(fit)) return null;
    if (fit === "mismatch") mismatch += 1;
    out.push({ id, label, fit });
  }
  if (mismatch !== 1) return null;
  return out;
}

export function normalizeStrategyId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s === "custom") return "custom";
  if (/^s[1-9]\w*$/i.test(s) || s.length <= 24) return s;
  return s.slice(0, 24);
}
