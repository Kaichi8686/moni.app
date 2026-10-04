import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeCoachingContext, parseCoachingContext, type CoachingContext } from "@/lib/projects/coachingContext";

/**
 * coaching_context を DB の最新値にマージして保存する。
 * ローカル state だけを正にすると、ストリーク更新など並行書き込みを潰してしまう。
 */
export async function saveCoachingContextPatch(
  client: SupabaseClient,
  projectId: string,
  patch: Partial<CoachingContext>,
): Promise<CoachingContext> {
  const { data, error } = await client.from("projects").select("coaching_context").eq("id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("project not found");

  const prev = parseCoachingContext((data as { coaching_context?: unknown }).coaching_context);
  const next = mergeCoachingContext(prev, patch);
  const { error: updateError } = await client
    .from("projects")
    .update({ coaching_context: next, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (updateError) throw new Error(updateError.message);
  return next;
}
