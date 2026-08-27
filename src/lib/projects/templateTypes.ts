import type { PhaseColor, RoadmapBusinessType } from "@/lib/roadmap/types";

export const TEMPLATE_DEFINITION_VERSION = 1;

export type TemplateArchetype = "application" | "service" | "hardware";

export type TemplatePhaseTaskDef = {
  title: string;
  priority?: "urgent" | "high" | "medium" | "low";
};

export type TemplatePhaseDef = {
  title: string;
  goal?: string;
  /** このフェーズで具体的にやること（ロードマップの description に保存） */
  guide?: string;
  durationDays: number;
  color?: PhaseColor;
  tasks?: TemplatePhaseTaskDef[];
};

export type ProjectTemplateDefinition = {
  version: number;
  phases: TemplatePhaseDef[];
  builtinKey?: RoadmapBusinessType;
  builtinTemplateId?: string;
};

export type TemplateListItem = {
  id: string;
  name: string;
  description: string;
  kind: "phases" | "milestones" | "both";
  phaseCount: number;
  isBuiltin: boolean;
  isPublic?: boolean;
  isOwn?: boolean;
  updatedAt?: string;
  archetype?: TemplateArchetype;
  sources?: string[];
  /** この型の使い方・向いている人 */
  usageGuide?: string;
};
