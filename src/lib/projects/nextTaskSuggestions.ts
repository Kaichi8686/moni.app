import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import type { TaskLikeForPick } from "@/lib/projects/todayThree";

export type RoadmapStepRef = { id: string; title: string; status: string };

/** ルールベースで「次の一歩」候補タイトルを返す（最大3件） */
export function suggestNextTaskTitles(params: {
  completedTitle: string;
  tasks: TaskLikeForPick[];
  roadmapSteps: RoadmapStepRef[];
  focusStepId: string | null;
}): string[] {
  const { tasks, roadmapSteps, focusStepId } = params;
  const active = tasks.filter((t) => normalizeTaskStatus(t.status) !== "done");
  const sameMilestone = focusStepId
    ? active.filter((t) => t.roadmap_step_id === focusStepId)
    : active;

  const titles: string[] = [];
  const pushUnique = (t: string) => {
    const x = t.trim();
    if (!x || titles.includes(x)) return;
    titles.push(x);
  };

  for (const t of sameMilestone.slice(0, 2)) {
    pushUnique(t.title);
    if (titles.length >= 3) return titles;
  }
  for (const t of active) {
    pushUnique(t.title);
    if (titles.length >= 3) return titles;
  }

  const focus = roadmapSteps.find((s) => s.id === focusStepId) ?? roadmapSteps.find((s) => s.status === "doing");
  const nextStep =
    roadmapSteps.find((s) => s.status === "todo") ??
    roadmapSteps.find((s) => s.status === "doing" && s.id !== focus?.id);
  if (nextStep) pushUnique(`${nextStep.title} の最初の一歩を決める（15分）`);
  pushUnique("進め方をチャットで一言シェアする");
  pushUnique("今日やったことを一言メモする");

  return titles.slice(0, 3);
}
