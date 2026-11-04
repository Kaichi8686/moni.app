import { parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";
import {
  applyBriefToCoachingContext,
  composeProjectDescription,
  emptyProjectBrief,
  resolveProjectBrief,
  trimProjectBrief,
  type ProjectBrief,
} from "@/lib/projects/projectBrief";
import { supabase } from "@/lib/supabase";

/** きっかけ・ゴールを projects.description / coaching_context に保存 */
export async function persistProjectMotivationAndGoal(input: {
  projectId: string;
  coachingContext?: unknown | CoachingContext;
  description?: string | null;
  problemMotivation: string;
  projectGoal: string;
}): Promise<ProjectBrief> {
  if (!supabase) throw new Error("Supabase is not configured");

  const current = resolveProjectBrief({
    coachingContext: input.coachingContext,
    description: input.description,
  });
  const nextBrief: ProjectBrief = {
    ...emptyProjectBrief(),
    whatToDo: current.whatToDo,
    problemMotivation: input.problemMotivation,
    projectGoal: input.projectGoal,
  };
  const trimmed = trimProjectBrief(nextBrief);
  if (!trimmed.problemMotivation || !trimmed.projectGoal) {
    throw new Error("BRIEF_INCOMPLETE");
  }

  const descriptionText = composeProjectDescription(trimmed);
  const nextCoaching = applyBriefToCoachingContext(
    parseCoachingContext(input.coachingContext),
    trimmed,
  );
  const payload: Record<string, unknown> = {
    description: descriptionText,
    coaching_context: nextCoaching,
    updated_at: new Date().toISOString(),
  };

  let { error: updateError } = await supabase.from("projects").update(payload).eq("id", input.projectId);
  if (updateError) {
    const schemaMismatch =
      updateError.code === "42703" ||
      updateError.code === "PGRST204" ||
      updateError.message.includes("does not exist") ||
      updateError.message.includes("schema cache");
    if (schemaMismatch) {
      const { coaching_context: _drop, ...withoutCoaching } = payload;
      void _drop;
      const retry = await supabase.from("projects").update(withoutCoaching).eq("id", input.projectId);
      updateError = retry.error;
    }
  }
  if (updateError) throw new Error(updateError.message);
  return trimmed;
}
