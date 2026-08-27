import { supabase } from "@/lib/supabase";
import {
  buildPhaseInsertRows,
  builtinTemplateListItems,
  resolveBuiltinTemplateDefinition,
  exportPhasesToDefinition,
  parseTemplateDefinition,
  type ProjectTemplateDefinition,
  type TemplateListItem,
} from "@/lib/projects/templateDefinition";
import type { RoadmapBusinessType, RoadmapPhase } from "@/lib/roadmap/types";
import { buildIssueScheduleContext, createRoadmapIssuesFromDefinition } from "@/lib/templates/createRoadmapIssues";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";
import { projectIssueContextFromRow } from "@/lib/workspace/personalizeProjectIssues";

export type { TemplateListItem, ProjectTemplateDefinition };

export function isTemplatesSchemaError(error?: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || m.includes("project_templates") || m.includes("does not exist");
}

export async function listProjectTemplates(userId: string | null): Promise<{
  builtin: TemplateListItem[];
  user: TemplateListItem[];
  schemaMissing: boolean;
}> {
  const builtin = builtinTemplateListItems();
  if (!supabase || !userId) return { builtin, user: [], schemaMissing: false };

  const { data, error } = await supabase
    .from("project_templates")
    .select("id,name,description,kind,definition,is_public,updated_at,owner_id")
    .or(`owner_id.eq.${userId},is_public.eq.true`)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (isTemplatesSchemaError(error)) {
    return { builtin, user: [], schemaMissing: true };
  }
  if (error) throw new Error(error.message);

  const user: TemplateListItem[] = (data ?? []).map((row) => {
    const def = parseTemplateDefinition(row.definition);
    return {
      id: row.id as string,
      name: String(row.name),
      description: String(row.description ?? ""),
      kind: (row.kind as TemplateListItem["kind"]) ?? "phases",
      phaseCount: def?.phases.length ?? 0,
      isBuiltin: false,
      isPublic: Boolean(row.is_public),
      isOwn: row.owner_id === userId,
      updatedAt: row.updated_at as string,
      usageGuide: String(row.description ?? "").trim() || undefined,
    };
  });

  return { builtin, user, schemaMissing: false };
}

export async function resolveTemplateDefinition(templateId: string): Promise<ProjectTemplateDefinition | null> {
  if (templateId.startsWith("builtin:")) {
    return resolveBuiltinTemplateDefinition(templateId);
  }
  if (!supabase) return null;
  const { data, error } = await supabase.from("project_templates").select("definition").eq("id", templateId).maybeSingle();
  if (error) throw new Error(error.message);
  return parseTemplateDefinition(data?.definition);
}

export async function saveProjectAsTemplate(input: {
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  phases: RoadmapPhase[];
  isPublic?: boolean;
}): Promise<string> {
  if (!supabase) throw new Error("接続設定が見つかりません。");
  const definition = exportPhasesToDefinition(input.phases);
  if (definition.phases.length === 0) throw new Error("フェーズがないため、型として保存できません。");

  const { data, error } = await supabase
    .from("project_templates")
    .insert({
      owner_id: input.userId,
      source_project_id: input.projectId,
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      kind: "phases",
      definition,
      is_public: Boolean(input.isPublic),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteProjectTemplate(templateId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("接続設定が見つかりません。");
  const { error } = await supabase.from("project_templates").delete().eq("id", templateId).eq("owner_id", userId);
  if (error) throw new Error(error.message);
}

export type ApplyTemplateMode = "append" | "replace";

export async function applyTemplateToProject(input: {
  projectId: string;
  templateId: string;
  mode: ApplyTemplateMode;
  projectStart: Date;
  existingPhases: RoadmapPhase[];
}): Promise<{ phasesCreated: number; tasksCreated: number; issuesCreated: number }> {
  if (!supabase) throw new Error("接続設定が見つかりません。");

  const definition = await resolveTemplateDefinition(input.templateId);
  if (!definition) throw new Error("テンプレートの内容を読み込めませんでした。");

  if (input.mode === "replace" && input.existingPhases.length > 0) {
    const { error: delErr } = await supabase.from("project_phases").delete().eq("project_id", input.projectId);
    if (delErr) throw new Error(delErr.message);
  }

  const orderOffset =
    input.mode === "replace" ? 0 : input.existingPhases.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const existingCount = input.mode === "replace" ? 0 : input.existingPhases.length;

  const rows = buildPhaseInsertRows(
    input.projectId,
    definition,
    input.projectStart,
    orderOffset,
    existingCount,
  );

  const { data: inserted, error: phErr } = await supabase.from("project_phases").insert(rows).select("id, order");
  if (phErr) throw new Error(phErr.message);

  let tasksCreated = 0;
  const sortedDef = definition.phases;
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
    const phaseDef = sortedDef[i];
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
      name: String((projRow as { name?: string } | null)?.name ?? "プロジェクト"),
      description: (projRow as { description?: string } | null)?.description,
      category: (projRow as { category?: string } | null)?.category,
      business_type: (projRow as { business_type?: string | null } | null)?.business_type,
      recruitment_target: (projRow as { recruitment_target?: string } | null)?.recruitment_target,
      recruitment_message: (projRow as { recruitment_message?: string } | null)?.recruitment_message,
    }),
  });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (definition.builtinTemplateId?.startsWith("app-")) {
    updates.roadmap_business_type = "app";
  } else if (definition.builtinTemplateId?.startsWith("svc-")) {
    updates.roadmap_business_type = "other";
  } else if (definition.builtinTemplateId?.startsWith("hw-")) {
    updates.roadmap_business_type = "other";
  }
  if (!input.templateId.startsWith("builtin:")) {
    updates.last_template_id = input.templateId;
  }
  await supabase.from("projects").update(updates).eq("id", input.projectId);

  return { phasesCreated: rows.length, tasksCreated, issuesCreated };
}

/** ロードマップのフェーズ構成をすべて削除（フェーズ内タスクも連動削除。課題は残る） */
export async function clearProjectRoadmapStructure(projectId: string): Promise<number> {
  if (!supabase) throw new Error("接続設定が見つかりません。");

  const { data: existing, error: countErr } = await supabase
    .from("project_phases")
    .select("id")
    .eq("project_id", projectId);
  if (countErr) throw new Error(countErr.message);

  const n = existing?.length ?? 0;
  if (n === 0) return 0;

  const { error: delErr } = await supabase.from("project_phases").delete().eq("project_id", projectId);
  if (delErr) throw new Error(delErr.message);

  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString(), last_template_id: null })
    .eq("id", projectId);

  return n;
}
