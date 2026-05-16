import { normalizeTaskStatus } from "@/lib/projects/taskStatus";
import { startOfWeekMondayJapanMs } from "@/lib/projects/teamActivityStreak";

/** 今週（月曜開始・東京）に完了したタスク件数 */
export function countWeekCompletedTasksJapan(
  tasks: Array<{ status: string | null | undefined; updated_at: string }>,
  now = new Date(),
): number {
  const cutoff = startOfWeekMondayJapanMs(now);
  return tasks.filter(
    (t) => normalizeTaskStatus(t.status) === "done" && new Date(t.updated_at).getTime() >= cutoff,
  ).length;
}
