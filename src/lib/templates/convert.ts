import { ARCHETYPE_LABELS } from "@/lib/projects/builtinRoadmapTemplates";
import type { ProjectTemplateDefinition, TemplatePhaseDef, TemplateListItem } from "@/lib/projects/templateTypes";
import type { GalleryCategory, GalleryTemplateView, SystemTemplate, SystemTemplatePhase, UserRoadmapTemplateRow } from "@/lib/templates/types";
import type { RoadmapPhase } from "@/lib/roadmap/types";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";

function phaseGuide(phase: SystemTemplatePhase): string {
  const parts: string[] = [];
  if (phase.description?.trim()) parts.push(phase.description.trim());
  if (phase.keyQuestions?.length) {
    parts.push("【考えてみること】\n" + phase.keyQuestions.map((q) => `・${q}`).join("\n"));
  }
  return parts.join("\n\n");
}

export function systemTemplateToDefinition(template: SystemTemplate): ProjectTemplateDefinition {
  return {
    version: 1,
    builtinTemplateId: template.id,
    phases: template.phases.map((p) => ({
      title: simplifyIssueText(p.title),
      goal: simplifyIssueText(p.goal),
      guide: phaseGuide(p),
      durationDays: Math.max(1, p.defaultDurationDays),
      color: p.color,
      tasks: (p.milestones ?? []).map((title) => ({
        title: simplifyIssueText(title),
        priority: "medium" as const,
      })),
    })),
  };
}

export function phasesJsonToDefinition(phasesJson: unknown): ProjectTemplateDefinition | null {
  if (!Array.isArray(phasesJson)) return null;
  const phases: TemplatePhaseDef[] = [];
  for (const raw of phasesJson) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const title = String(p.title ?? "").trim();
    if (!title) continue;
    const milestones = Array.isArray(p.milestones) ? p.milestones.map((m) => String(m).trim()).filter(Boolean) : [];
    const tasksFromMilestones = milestones.map((title) => ({ title, priority: "medium" as const }));
    const tasksFromTasks = Array.isArray(p.tasks)
      ? (p.tasks as unknown[])
          .map((t) => {
            if (!t || typeof t !== "object") return null;
            const tr = t as Record<string, unknown>;
            const tt = String(tr.title ?? "").trim();
            return tt ? { title: tt, priority: "medium" as const } : null;
          })
          .filter((x): x is { title: string; priority: "medium" } => x !== null)
      : [];
    phases.push({
      title,
      goal: String(p.goal ?? "").trim(),
      guide: String(p.description ?? p.guide ?? "").trim() || undefined,
      durationDays: Math.max(1, Number(p.defaultDurationDays ?? p.durationDays) || 14),
      color:
        p.color === "purple" ||
        p.color === "blue" ||
        p.color === "green" ||
        p.color === "amber" ||
        p.color === "red" ||
        p.color === "gray"
          ? p.color
          : undefined,
      tasks: tasksFromMilestones.length ? tasksFromMilestones : tasksFromTasks.length ? tasksFromTasks : undefined,
    });
  }
  if (phases.length === 0) return null;
  return { version: 1, phases };
}

export function projectDefinitionToPhases(def: ProjectTemplateDefinition): SystemTemplatePhase[] {
  return def.phases.map((p, order) => ({
    title: p.title,
    goal: p.goal ?? "",
    description: p.guide,
    status: "planned",
    color: p.color ?? "blue",
    order,
    defaultDurationDays: p.durationDays,
    milestones: p.tasks?.map((t) => t.title),
  }));
}

function archetypeToCategory(archetype?: TemplateListItem["archetype"]): GalleryCategory {
  if (archetype === "hardware") return "hardware";
  if (archetype === "service") return "service";
  if (archetype === "application") return "app";
  return "other";
}

export function templateListItemToGalleryView(item: TemplateListItem, phases: SystemTemplatePhase[]): GalleryTemplateView {
  const emoji = item.archetype ? ARCHETYPE_LABELS[item.archetype].emoji : "📋";
  return {
    id: item.id,
    title: item.name,
    description: item.description,
    category: archetypeToCategory(item.archetype),
    businessType: item.sources?.[0] ?? (item.isBuiltin ? "書籍・フレームワーク" : "保存した型"),
    thumbnailEmoji: emoji,
    tags: item.isBuiltin && item.sources?.length ? item.sources.slice(0, 2) : [],
    authorLabel: item.isBuiltin ? "書籍・フレームワーク" : item.isOwn ? "自分の型" : "チーム",
    isOfficial: item.isBuiltin,
    source: "project",
    projectTemplateId: item.id,
    phaseCount: item.phaseCount,
    sources: item.sources,
    usageGuide: item.usageGuide ?? item.description,
    phases,
  };
}

export function systemTemplateToGalleryView(t: SystemTemplate): GalleryTemplateView {
  return {
    id: `system:${t.id}`,
    title: t.title,
    description: t.description,
    category: t.category,
    businessType: t.businessType,
    thumbnailEmoji: t.thumbnailEmoji,
    tags: t.tags,
    authorLabel: t.authorLabel,
    isOfficial: true,
    source: "system",
    phaseCount: t.phases.length,
    phases: t.phases,
  };
}

export function userRowToGalleryView(row: UserRoadmapTemplateRow, authorLabel: string): GalleryTemplateView | null {
  const def = phasesJsonToDefinition(row.phases_json);
  if (!def) return null;
  const phases: SystemTemplatePhase[] = def.phases.map((p, order) => ({
    title: p.title,
    goal: p.goal ?? "",
    description: p.guide,
    status: "planned",
    color: p.color ?? "blue",
    order,
    defaultDurationDays: p.durationDays,
    milestones: p.tasks?.map((t) => t.title),
  }));
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    businessType: row.business_type ?? "",
    thumbnailEmoji: row.thumbnail_emoji || "📋",
    tags: row.tags ?? [],
    authorLabel,
    isOfficial: false,
    source: "community",
    phaseCount: phases.length,
    useCount: row.use_count,
    likeCount: row.like_count,
    phases,
  };
}

export function roadmapPhasesToPublishJson(phases: RoadmapPhase[]): unknown[] {
  return [...phases]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      let durationDays = 14;
      try {
        durationDays = Math.max(1, differenceInCalendarDays(parseISO(p.endDate.slice(0, 10)), parseISO(p.startDate.slice(0, 10))) + 1);
      } catch {
        /* default */
      }
      return {
        title: p.title,
        goal: p.goal ?? "",
        description: p.description ?? "",
        color: p.color,
        order: p.order,
        defaultDurationDays: durationDays,
        milestones: p.tasks.filter((t) => t.status !== "cancelled").map((t) => t.title),
      };
    });
}

export function galleryViewToDefinition(
  view: GalleryTemplateView,
  systemTemplates: SystemTemplate[],
): ProjectTemplateDefinition {
  if (view.source === "system") {
    const id = view.id.replace(/^system:/, "");
    const found = systemTemplates.find((t) => t.id === id);
    if (found) return systemTemplateToDefinition(found);
  }
  return phasesJsonToDefinition(
    view.phases.map((p) => ({
      title: p.title,
      goal: p.goal,
      description: p.description,
      color: p.color,
      order: p.order,
      defaultDurationDays: p.defaultDurationDays,
      milestones: p.milestones,
    })),
  )!;
}
