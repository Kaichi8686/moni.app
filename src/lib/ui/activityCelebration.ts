"use client";

import { burstCelebration } from "@/lib/ui/confetti";

const STREAK_CONFETTI_THRESHOLDS = [3, 7, 14, 30] as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** ストリークが閾値をまたいだとき 1 回 */
export function maybeCelebrateStreakMilestone(prevStreak: number, nextStreak: number): void {
  if (prefersReducedMotion()) return;
  for (const m of STREAK_CONFETTI_THRESHOLDS) {
    if (prevStreak < m && nextStreak >= m) {
      burstCelebration();
      return;
    }
  }
}

/** 今週の完了数が週目標に達したとき 1 回 */
export function maybeCelebrateWeeklyGoalReached(prevDone: number, nextDone: number, goal: number | undefined): void {
  if (!goal || goal < 1) return;
  if (prefersReducedMotion()) return;
  if (prevDone < goal && nextDone >= goal) burstCelebration();
}
