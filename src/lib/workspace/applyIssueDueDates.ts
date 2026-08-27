import { supabase } from "@/lib/supabase";
import type { Issue } from "@/lib/workspace/types";
import type { Phase } from "@/lib/workspace/types";
import { hasMeaningfulTargetDate, planIssueDueDates, type PhaseWindow } from "@/lib/workspace/issueDueSchedule";

export function buildPhaseWindows(phases: Phase[]): PhaseWindow[] {
  return phases.map((p) => ({
    id: p.id,
    order: p.order,
    startDate: p.startDate,
    endDate: p.endDate,
  }));
}

/** 完成日に合わせて未完了課題の期限をDBへ反映（忙しい日を避ける） */
export async function applyIssueDueDatesForProject(input: {
  projectId: string;
  projectStart: string;
  projectTarget: string;
  phases: Phase[];
  issues: Issue[];
  blockedDateKeys?: Set<string>;
}): Promise<number> {
  if (!supabase) throw new Error("接続設定が見つかりません。");
  if (!hasMeaningfulTargetDate(input.projectTarget, input.projectStart)) return 0;

  const plan = planIssueDueDates({
    projectStart: input.projectStart,
    projectTarget: input.projectTarget,
    phases: buildPhaseWindows(input.phases),
    issues: input.issues.map((i) => ({ id: i.id, phaseId: i.phaseId, status: i.status })),
    blockedDateKeys: input.blockedDateKeys,
  });

  if (plan.size === 0) return 0;

  const now = new Date().toISOString();
  let updated = 0;
  for (const [id, due_date] of plan) {
    const current = input.issues.find((i) => i.id === id);
    if (current?.dueDate && current.dueDate.slice(0, 10) === due_date.slice(0, 10)) {
      continue;
    }
    const { error } = await supabase
      .from("project_issues")
      .update({ due_date, updated_at: now })
      .eq("id", id)
      .eq("project_id", input.projectId);
    if (!error) updated += 1;
  }
  return updated;
}
