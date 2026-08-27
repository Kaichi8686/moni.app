import { supabase } from "@/lib/supabase";
import type { ProjectTemplateDefinition } from "@/lib/projects/templateTypes";
import { buildWorkflowForMilestone } from "@/lib/workspace/issueWorkflow";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";
import {
  personalizeIssueDescription,
  personalizeIssueTitle,
  type ProjectIssueContext,
} from "@/lib/workspace/personalizeProjectIssues";
import { dueIsoForNewIssueInPhase, hasMeaningfulTargetDate } from "@/lib/workspace/issueDueSchedule";
import type { PhaseWindow } from "@/lib/workspace/issueDueSchedule";
import { busyDateKeysFromSchedules } from "@/lib/workspace/busyScheduleDays";

export type PhaseInsertRow = { id: string; order: number };

export type IssueScheduleContext = {
  projectStart: string;
  projectTarget: string;
  phaseWindows: PhaseWindow[];
  blockedDateKeys?: Set<string>;
};

export function buildIssueScheduleContext(input: {
  projectStart: string;
  projectTarget?: string | null;
  phases: Array<{ id: string; order: number; startDate: string; endDate: string }>;
  schedules?: Array<{
    kind?: "event" | "busy";
    description?: string | null;
    starts_at: string;
    ends_at?: string | null;
  }>;
}): IssueScheduleContext | undefined {
  if (!hasMeaningfulTargetDate(input.projectTarget, input.projectStart)) return undefined;
  return {
    projectStart: input.projectStart,
    projectTarget: input.projectTarget!,
    phaseWindows: input.phases.map((p) => ({
      id: p.id,
      order: p.order,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
    blockedDateKeys: input.schedules
      ? busyDateKeysFromSchedules(
          input.schedules.map((s) => ({
            kind: s.kind,
            description: s.description ?? "",
            starts_at: s.starts_at,
            ends_at: s.ends_at ?? null,
          })),
        )
      : undefined,
  };
}

export async function createRoadmapIssuesFromDefinition(input: {
  projectId: string;
  definition: ProjectTemplateDefinition;
  insertedPhases: PhaseInsertRow[];
  skipIfPhaseHasIssues?: boolean;
  existingIssueTitlesByPhase?: Map<string, Set<string>>;
  schedule?: IssueScheduleContext;
  projectContext: ProjectIssueContext;
}): Promise<number> {
  if (!supabase) throw new Error("接続設定が見つかりません。");

  const sorted = [...input.insertedPhases].sort((a, b) => a.order - b.order);
  const payload: Array<Record<string, unknown>> = [];
  const phaseWindowById = new Map(input.schedule?.phaseWindows.map((p) => [p.id, p]) ?? []);
  const useSchedule =
    input.schedule && hasMeaningfulTargetDate(input.schedule.projectTarget, input.schedule.projectStart);

  for (let i = 0; i < sorted.length; i++) {
    const phaseRow = sorted[i];
    const phaseDef = input.definition.phases[i];
    if (!phaseDef?.tasks?.length || !phaseRow) continue;

    const existingTitles = input.existingIssueTitlesByPhase?.get(phaseRow.id);
    if (input.skipIfPhaseHasIssues && existingTitles && existingTitles.size > 0) continue;

    const totalInPhase = phaseDef.tasks.filter((t) => t.title.trim()).length;
    let indexInPhase = 0;

    for (const task of phaseDef.tasks) {
      const rawTitle = task.title.trim();
      if (!rawTitle) continue;
      if (existingTitles?.has(rawTitle) || existingTitles?.has(simplifyIssueText(rawTitle))) continue;

      const phaseBits = { title: phaseDef.title, goal: phaseDef.goal };
      const title = personalizeIssueTitle(rawTitle, input.projectContext, phaseBits);
      const workflow = buildWorkflowForMilestone({
        milestoneTitle: title,
        phaseTitle: simplifyIssueText(phaseDef.title),
        phaseGoal: phaseDef.goal,
        phaseGuide: phaseDef.guide,
        projectName: input.projectContext.projectName,
        projectAudience: input.projectContext.audience,
      });

      let due_date: string | null = null;
      if (useSchedule && input.schedule) {
        const window = phaseWindowById.get(phaseRow.id);
        if (window) {
          due_date = dueIsoForNewIssueInPhase({
            projectStart: input.schedule.projectStart,
            projectTarget: input.schedule.projectTarget,
            phaseStart: window.startDate,
            phaseEnd: window.endDate,
            indexInPhase,
            countInPhase: totalInPhase,
            blockedDateKeys: input.schedule.blockedDateKeys,
          });
        }
      }
      indexInPhase += 1;

      payload.push({
        project_id: input.projectId,
        phase_id: phaseRow.id,
        title,
        description: personalizeIssueDescription({
          ctx: input.projectContext,
          phaseTitle: phaseDef.title,
          phaseGoal: phaseDef.goal,
          phaseGuide: phaseDef.guide,
          taskTitle: title,
        }),
        status: "todo",
        priority: task.priority ?? "medium",
        assignee_id: null,
        due_date,
        labels: ["roadmap"],
        workflow_json: workflow,
      });
    }
  }

  if (payload.length === 0) return 0;

  const { error } = await supabase.from("project_issues").insert(payload);
  if (error) {
    const missingCol = error.message.toLowerCase().includes("workflow_json");
    if (!missingCol) throw new Error(error.message);
    const fallback = payload.map(({ workflow_json, ...rest }) => ({
      ...rest,
      description: `${String(rest.description ?? "")}\n\n---moni-workflow-v1---\n${JSON.stringify(workflow_json)}`,
    }));
    const { error: err2 } = await supabase.from("project_issues").insert(fallback);
    if (err2) throw new Error(err2.message);
  }

  return payload.length;
}

/** 既存フェーズの phase_tasks / マイルストーン名から課題を補完 */
export async function syncRoadmapIssuesFromPhases(input: {
  projectId: string;
  phases: Array<{ id: string; title: string; goal?: string; description?: string; order: number; startDate?: string; endDate?: string }>;
  taskTitlesByPhase: Map<string, string[]>;
  existingIssues: Array<{ phaseId?: string; title: string }>;
  schedule?: IssueScheduleContext;
  projectContext: ProjectIssueContext;
}): Promise<number> {
  const existingByPhase = new Map<string, Set<string>>();
  for (const iss of input.existingIssues) {
    if (!iss.phaseId) continue;
    if (!existingByPhase.has(iss.phaseId)) existingByPhase.set(iss.phaseId, new Set());
    existingByPhase.get(iss.phaseId)!.add(iss.title.trim());
  }

  const definition: ProjectTemplateDefinition = {
    version: 1,
    phases: [...input.phases]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        title: p.title,
        goal: p.goal ?? "",
        guide: p.description,
        durationDays: 14,
        tasks: (input.taskTitlesByPhase.get(p.id) ?? []).map((title: string) => ({
          title,
          priority: "medium" as const,
        })),
      })),
  };

  const insertedPhases: PhaseInsertRow[] = input.phases.map((p) => ({ id: p.id, order: p.order }));

  return createRoadmapIssuesFromDefinition({
    projectId: input.projectId,
    definition,
    insertedPhases,
    skipIfPhaseHasIssues: false,
    existingIssueTitlesByPhase: existingByPhase,
    schedule: input.schedule,
    projectContext: input.projectContext,
  });
}
