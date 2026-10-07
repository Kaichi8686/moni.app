"use client";

import { burstCelebration, burstSoftCompletion } from "@/lib/ui/confetti";

const STREAK_CONFETTI_THRESHOLDS = [3, 7, 14, 30] as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export function crossesStreakMilestone(prevStreak: number, nextStreak: number): boolean {
  return STREAK_CONFETTI_THRESHOLDS.some((m) => prevStreak < m && nextStreak >= m);
}

export function crossesWeeklyGoal(prevDone: number, nextDone: number, goal: number | undefined): boolean {
  return Boolean(goal && goal >= 1 && prevDone < goal && nextDone >= goal);
}

/** タスク完了時の控えめな達成感（週目標・ストリークの大きい祝福とは別） */
export function celebrateTaskComplete(): void {
  if (prefersReducedMotion()) return;
  burstSoftCompletion();
}

/** ストリークが閾値をまたいだとき 1 回 */
export function maybeCelebrateStreakMilestone(prevStreak: number, nextStreak: number): void {
  if (prefersReducedMotion()) return;
  if (crossesStreakMilestone(prevStreak, nextStreak)) burstCelebration();
}

/** 今週の完了数が週目標に達したとき 1 回 */
export function maybeCelebrateWeeklyGoalReached(prevDone: number, nextDone: number, goal: number | undefined): void {
  if (prefersReducedMotion()) return;
  if (crossesWeeklyGoal(prevDone, nextDone, goal)) burstCelebration();
}
