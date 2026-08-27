import { addDays } from "date-fns";
import type { RoadmapAgentPayload } from "@/lib/ai/geminiAgents/types";
import { supabase } from "@/lib/supabase";

function timelineWeekOffset(timeline?: string): number {
  const t = (timeline ?? "").trim();
  if (t.includes("今日") || t.includes("今週")) return 0;
  if (t.includes("来週")) return 1;
  if (t.includes("今月")) return 2;
  return 0;
}

export type ApplyRoadmapMode = "append" | "replace";

export async function applyAgentRoadmapToProject(
  projectId: string,
  payload: RoadmapAgentPayload,
  options?: { mode?: ApplyRoadmapMode },
): Promise<{ phasesCreated: number; issuesCreated: number }> {
  if (!supabase) throw new Error("Supabase が未設定です。");

  const mode = options?.mode ?? "append";
  let order = 0;

  if (mode === "replace") {
    const { data: existingIssues } = await supabase.from("project_issues").select("id").eq("project_id", projectId);
    const ids = (existingIssues ?? []).map((r) => r.id as string);
    if (ids.length > 0) await supabase.from("project_issues").delete().in("id", ids);
    await supabase.from("project_phases").delete().eq("project_id", projectId);
  } else {
    const { data: existingPhases } = await supabase
      .from("project_phases")
      .select("order")
      .eq("project_id", projectId)
      .order("order", { ascending: false })
      .limit(1);
    order = ((existingPhases?.[0] as { order?: number } | undefined)?.order ?? -1) + 1;
  }

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let phasesCreated = 0;
  let issuesCreated = 0;

  for (const phase of payload.phases.slice(0, 6)) {
    const title = (phase.phase_name ?? "").trim().slice(0, 120);
    if (!title) continue;

    const start = addDays(base, timelineWeekOffset(phase.timeline) * 7 + order);
    const end = addDays(start, 6);
    const description = [phase.timeline ? `期間: ${phase.timeline}` : "", phase.why ? `ねらい: ${phase.why}` : ""]
      .filter(Boolean)
      .join("\n");

    const { data: row, error: phaseErr } = await supabase
      .from("project_phases")
      .insert({
        project_id: projectId,
        title,
        description,
        status: order === 0 && mode === "replace" ? "in_progress" : "planned",
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        color: "purple",
        order,
      })
      .select("id")
      .single();

    if (phaseErr || !row?.id) throw new Error(phaseErr?.message ?? "フェーズの保存に失敗しました。");
    phasesCreated += 1;

    for (const task of (phase.tasks ?? []).slice(0, 8)) {
      const taskTitle = (task.task_title ?? "").trim().slice(0, 200);
      if (!taskTitle) continue;
      const { error: issueErr } = await supabase.from("project_issues").insert({
        project_id: projectId,
        phase_id: row.id,
        title: taskTitle,
        description: task.advice?.trim() ? `ヒント: ${task.advice.trim()}` : "",
        status: "todo",
        priority: "medium",
      });
      if (issueErr) throw new Error(issueErr.message);
      issuesCreated += 1;
    }
    order += 1;
  }

  if (phasesCreated === 0) {
    throw new Error("反映できるフェーズがありませんでした。もう一度AIに計画を作ってもらってください。");
  }

  return { phasesCreated, issuesCreated };
}
