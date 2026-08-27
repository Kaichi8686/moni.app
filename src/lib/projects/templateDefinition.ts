import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import {
  getBuiltinDefinitionByTemplateId,
  listBuiltinByArchetype,
  listBuiltinRoadmapTemplateItems,
} from "@/lib/projects/builtinRoadmapTemplates";
import {
  TEMPLATE_DEFINITION_VERSION,
  type ProjectTemplateDefinition,
  type TemplateListItem,
  type TemplatePhaseDef,
  type TemplatePhaseTaskDef,
} from "@/lib/projects/templateTypes";
import type { PhaseColor, RoadmapBusinessType, RoadmapPhase } from "@/lib/roadmap/types";

export type {
  ProjectTemplateDefinition,
  TemplateArchetype,
  TemplateListItem,
  TemplatePhaseDef,
  TemplatePhaseTaskDef,
} from "@/lib/projects/templateTypes";
export { TEMPLATE_DEFINITION_VERSION };

const COLORS: PhaseColor[] = ["purple", "blue", "green", "amber", "red"];

export function parseTemplateDefinition(raw: unknown): ProjectTemplateDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.phases)) return null;
  const phases: TemplatePhaseDef[] = [];
  for (const p of o.phases) {
    if (!p || typeof p !== "object") continue;
    const row = p as Record<string, unknown>;
    const title = String(row.title ?? "").trim();
    if (!title) continue;
    const durationDays = Math.max(1, Number(row.durationDays) || 14);
    const tasks: TemplatePhaseTaskDef[] = [];
    if (Array.isArray(row.tasks)) {
      for (const t of row.tasks) {
        if (!t || typeof t !== "object") continue;
        const tr = t as Record<string, unknown>;
        const tt = String(tr.title ?? "").trim();
        if (!tt) continue;
        const pr = tr.priority;
        tasks.push({
          title: tt,
          priority:
            pr === "urgent" || pr === "high" || pr === "low" || pr === "medium" ? pr : "medium",
        });
      }
    }
    const guideRaw = row.guide ?? (row as Record<string, unknown>).description;
    phases.push({
      title,
      goal: String(row.goal ?? "").trim(),
      guide: typeof guideRaw === "string" ? guideRaw.trim() : undefined,
      durationDays,
      color: normalizeColor(row.color),
      tasks: tasks.length ? tasks : undefined,
    });
  }
  if (phases.length === 0) return null;
  return {
    version: Number(o.version) || TEMPLATE_DEFINITION_VERSION,
    phases,
    builtinKey: typeof o.builtinKey === "string" ? (o.builtinKey as RoadmapBusinessType) : undefined,
  };
}

function normalizeColor(v: unknown): PhaseColor | undefined {
  const c = String(v ?? "");
  if (c === "purple" || c === "blue" || c === "green" || c === "amber" || c === "red" || c === "gray") return c;
  return undefined;
}

export function exportPhasesToDefinition(phases: RoadmapPhase[]): ProjectTemplateDefinition {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  return {
    version: TEMPLATE_DEFINITION_VERSION,
    phases: sorted.map((p) => {
      const start = p.startDate.slice(0, 10);
      const end = p.endDate.slice(0, 10);
      let durationDays = 14;
      try {
        durationDays = Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1);
      } catch {
        /* keep default */
      }
      const tasks = p.tasks
        .filter((t) => t.status !== "cancelled")
        .map((t) => ({ title: t.title, priority: t.priority }));
      return {
        title: p.title,
        goal: p.goal ?? "",
        guide: p.description?.trim() || undefined,
        durationDays,
        color: p.color,
        tasks: tasks.length ? tasks : undefined,
      };
    }),
  };
}

export function builtinTemplateListItems(): TemplateListItem[] {
  return listBuiltinRoadmapTemplateItems();
}

export function builtinTemplatesGrouped() {
  return listBuiltinByArchetype();
}

export function resolveBuiltinTemplateDefinition(templateId: string): ProjectTemplateDefinition | null {
  return getBuiltinDefinitionByTemplateId(templateId);
}

export type PhaseInsertRow = {
  project_id: string;
  title: string;
  goal: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  color: string;
  order: number;
};

export function buildPhaseInsertRows(
  projectId: string,
  definition: ProjectTemplateDefinition,
  projectStart: Date,
  orderOffset: number,
  existingPhaseCount: number,
): PhaseInsertRow[] {
  let cursor = new Date(projectStart);
  return definition.phases.map((item, idx) => {
    const start = new Date(cursor);
    const end = addDays(start, Math.max(1, item.durationDays) - 1);
    cursor = addDays(end, 1);
    const globalIdx = orderOffset + idx;
    return {
      project_id: projectId,
      title: item.title,
      goal: (item.goal ?? "").trim(),
      description: (item.guide ?? "").trim(),
      status: existingPhaseCount === 0 && idx === 0 ? "in_progress" : "planned",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      color: item.color ?? COLORS[globalIdx % COLORS.length],
      order: globalIdx,
    };
  });
}
