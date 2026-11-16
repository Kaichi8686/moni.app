import { OFFICE_LEVEL_THRESHOLDS } from "@/lib/office/constants";
import type { StoryTone } from "@/lib/office/types";

export function scoreTotal(
  solve: number,
  fun: number,
  feasible: number,
  fit: number = 50,
): number {
  const s = clampScore(solve);
  const f = clampScore(fun);
  const e = clampScore(feasible);
  const i = clampScore(fit);
  return Math.round(s * 0.35 + f * 0.25 + e * 0.2 + i * 0.2);
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function storyToneFromTotal(total: number): StoryTone {
  const t = clampScore(total);
  if (t >= 70) return "great";
  if (t >= 40) return "ok";
  return "bitter";
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
  const idx = Math.max(1, level);
  if (idx >= OFFICE_LEVEL_THRESHOLDS.length) return null;
  return OFFICE_LEVEL_THRESHOLDS[idx] ?? null;
}
