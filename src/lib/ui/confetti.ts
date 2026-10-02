"use client";

import confetti from "canvas-confetti";

/** 完了時の軽いフィードバック（モーション軽減は呼び出し側で判定してもよい） */
export function burstCelebration(): void {
  if (typeof window === "undefined") return;
  void confetti({
    particleCount: 90,
    spread: 62,
    startVelocity: 36,
    ticks: 110,
    gravity: 1.05,
    origin: { y: 0.72 },
    colors: ["#FF5C35", "#FFB347", "#7CB342", "#42A5F5", "#FFF3D6"],
  });
}

/** タスク1件完了用の控えめなパルス（うるさくならない量） */
export function burstSoftCompletion(): void {
  if (typeof window === "undefined") return;
  void confetti({
    particleCount: 28,
    spread: 48,
    startVelocity: 22,
    ticks: 70,
    gravity: 1.15,
    scalar: 0.85,
    origin: { y: 0.78 },
    colors: ["#FF5C35", "#FFB347", "#FFD9CC"],
  });
}
