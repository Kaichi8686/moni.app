"use client";

export type PlayStep =
  | "incident"
  | "ask"
  | "strategy"
  | "target"
  | "write"
  | "result";

export type MissionPhase = "listen" | "plan" | "idea" | "result";

export const MISSION_PHASES: MissionPhase[] = ["listen", "plan", "idea", "result"];

export function missionPhaseFor(step: PlayStep): MissionPhase {
  switch (step) {
    case "incident":
    case "ask":
      return "listen";
    case "strategy":
    case "target":
      return "plan";
    case "write":
      return "idea";
    case "result":
      return "result";
  }
}

export function missionPhaseHint(
  step: PlayStep,
  asksRemaining?: number | null,
): string {
  switch (step) {
    case "incident":
      return "社員の話を聞こう";
    case "ask": {
      const n = asksRemaining ?? 2;
      return n > 0 ? `社員に${n}つ質問しよう` : "作戦を考えよう";
    }
    case "strategy":
      return "作戦を選ぼう";
    case "target":
      return "ターゲットを選ぼう";
    case "write":
      return "アイデアを書こう";
    case "result":
      return "結果を見よう";
  }
}

export function previousPlayStep(step: PlayStep): PlayStep | null {
  switch (step) {
    case "ask":
      return "incident";
    case "strategy":
      return "ask";
    case "target":
      return "strategy";
    case "write":
      return "target";
    default:
      return null;
  }
}
