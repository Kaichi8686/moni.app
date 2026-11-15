import { OFFICE_LEVEL_THRESHOLDS } from "@/lib/office/constants";

export function scoreTotal(solve: number, fun: number, feasible: number): number {
  const s = clampScore(solve);
  const f = clampScore(fun);
  const e = clampScore(feasible);
  return Math.round(s * 0.5 + f * 0.3 + e * 0.2);
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function levelFromRevenue(totalRevenue: number): number {
  const rev = Math.max(0, totalRevenue);
  let level = 1;
  for (let i = 0; i < OFFICE_LEVEL_THRESHOLDS.length; i++) {
    if (rev >= OFFICE_LEVEL_THRESHOLDS[i]!) level = i + 1;
  }
  return level;
}

export function nextLevelThreshold(level: number): number | null {
  const idx = Math.max(1, level); // level 1 → threshold index 1 is next
  if (idx >= OFFICE_LEVEL_THRESHOLDS.length) return null;
  return OFFICE_LEVEL_THRESHOLDS[idx] ?? null;
}
