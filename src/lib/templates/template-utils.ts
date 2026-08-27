import { supabase } from "@/lib/supabase";
import { buildPhaseInsertRows } from "@/lib/projects/templateDefinition";
import type { RoadmapPhase } from "@/lib/roadmap/types";
import { galleryViewToDefinition } from "@/lib/templates/convert";
import type { GalleryTemplateView } from "@/lib/templates/types";
import { buildIssueScheduleContext, createRoadmapIssuesFromDefinition } from "@/lib/templates/createRoadmapIssues";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";
import { projectIssueContextFromRow } from "@/lib/workspace/personalizeProjectIssues";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";

export function isRoadmapTemplatesSchemaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || m.includes("roadmap_templates");
}

export async function applyGalleryTemplate(input: {
  projectId: string;
  template: GalleryTemplateView;
  projectStart: Date;
  existingPhases: RoadmapPhase[];
  userId: string | null;
  replaceExisting?: boolean;
}): Promise<{ phasesCreated: number; tasksCreated: number; issuesCreated: number }> {
  if (!supabase) throw new Error("接続設定が見つかりません。");

  if (input.replaceExisting && input.existingPhases.length > 0) {
    const { error: delErr } = await supabase.from("project_phases").delete().eq("project_id", input.projectId);
    if (delErr) throw new Error(delErr.message);
  }

  const definition = galleryViewToDefinition(input.template, SYSTEM_TEMPLATES);
  const orderOffset =
    input.replaceExisting ? 0 : input.existingPhases.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const existingCount = input.replaceExisting ? 0 : input.existingPhases.length;

  const rows = buildPhaseInsertRows(input.projectId, definition, input.projectStart, orderOffset, existingCount);

  const { data: inserted, error: phErr } = await supabase.from("project_phases").insert(rows).select("id, order");
  if (phErr) throw new Error(phErr.message);

  let tasksCreated = 0;
  const insertedRows = (inserted ?? []) as Array<{ id: string; order: number }>;
  insertedRows.sort((a, b) => a.order - b.order);

  const taskPayload: Array<{
    project_id: string;
    phase_id: string;
    title: string;
    status: string;
    priority: string;
    is_today: boolean;
  }> = [];

  for (let i = 0; i < insertedRows.length; i++) {
    const phaseDef = definition.phases[i];
    const phaseRow = insertedRows[i];
    if (!phaseDef?.tasks?.length || !phaseRow) continue;
    for (const t of phaseDef.tasks) {
      taskPayload.push({
        project_id: input.projectId,
        phase_id: phaseRow.id,
        title: simplifyIssueText(t.title),
        status: "todo",
        priority: t.priority ?? "medium",
        is_today: false,
      });
    }
  }

  if (taskPayload.length > 0) {
    const { error: tErr } = await supabase.from("phase_tasks").insert(taskPayload);
    if (tErr && !tErr.message.toLowerCase().includes("phase_tasks")) {
      throw new Error(tErr.message);
    }
    tasksCreated = taskPayload.length;
  }

  const { data: projRow } = await supabase
    .from("projects")
    .select(
      "name, description, category, business_type, recruitment_target, recruitment_message, start_date, target_date",
    )
    .eq("id", input.projectId)
    .maybeSingle();
  const projectStartIso = (projRow as { start_date?: string } | null)?.start_date ?? input.projectStart.toISOString();
  const lastPhaseEnd = rows.length > 0 ? rows[rows.length - 1].end_date : null;
  const projectTargetIso =
    (projRow as { target_date?: string } | null)?.target_date ?? lastPhaseEnd ?? projectStartIso;

  const { data: schedRows } = await supabase
    .from("project_schedules")
    .select("id,title,description,starts_at,ends_at")
    .eq("project_id", input.projectId);

  const schedule = buildIssueScheduleContext({
    projectStart: projectStartIso,
    projectTarget: projectTargetIso,
    phases: insertedRows.map((row, i) => ({
      id: row.id,
      order: row.order,
      startDate: rows[i]?.start_date ?? projectStartIso,
      endDate: rows[i]?.end_date ?? projectTargetIso,
    })),
    schedules: (schedRows ?? []).map((s) => ({
      description: (s as { description?: string }).description ?? "",
      starts_at: (s as { starts_at: string }).starts_at,
      ends_at: (s as { ends_at?: string | null }).ends_at ?? null,
    })),
  });

  const issuesCreated = await createRoadmapIssuesFromDefinition({
    projectId: input.projectId,
    definition,
    insertedPhases: insertedRows,
    schedule,
    projectContext: projectIssueContextFromRow({
      name: String((projRow as { name?: string } | null)?.name ?? input.template.title),
      description: (projRow as { description?: string } | null)?.description,
      category: (projRow as { category?: string } | null)?.category,
      business_type: (projRow as { business_type?: string | null } | null)?.business_type,
      recruitment_target: (projRow as { recruitment_target?: string } | null)?.recruitment_target,
      recruitment_message: (projRow as { recruitment_message?: string } | null)?.recruitment_message,
    }),
  });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const cat = input.template.category;
  if (cat === "app") updates.roadmap_business_type = "app";
  else if (cat === "hardware" || cat === "service") updates.roadmap_business_type = "other";

  await supabase.from("projects").update(updates).eq("id", input.projectId);

  if (input.template.source === "community" && input.userId) {
    await supabase.from("template_uses").upsert(
      {
        template_id: input.template.id,
        user_id: input.userId,
        project_id: input.projectId,
      },
      { onConflict: "template_id,project_id" },
    );
    await supabase.rpc("increment_template_use", { tid: input.template.id });
  }

  return { phasesCreated: rows.length, tasksCreated, issuesCreated };
}
