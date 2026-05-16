/** ロードマップの「いまここ」計算（UI・ホーム・タスクで共通） */

export type RoadmapStepFocusFields = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done";
  position: number;
};

export function sortedRoadmapSteps<T extends RoadmapStepFocusFields>(steps: T[]): T[] {
  return [...steps].sort((a, b) => a.position - b.position);
}

/** 進行中があればその先頭、なければ未着手の先頭 */
export function pickFocusStep<T extends RoadmapStepFocusFields>(steps: T[]): T | null {
  const list = sortedRoadmapSteps(steps);
  const doing = list.find((s) => s.status === "doing");
  if (doing) return doing;
  return list.find((s) => s.status === "todo") ?? list[list.length - 1] ?? null;
}

export function roadmapDonePercent(steps: RoadmapStepFocusFields[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => s.status === "done").length;
  return Math.round((done / steps.length) * 100);
}
