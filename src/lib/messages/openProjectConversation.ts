import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateProjectConversation } from "@/lib/messages/api";

/** プロジェクトのグループライン（メールタブ）を開く */
export async function navigateToProjectConversation(
  client: SupabaseClient,
  router: AppRouterInstance,
  projectId: string,
): Promise<void> {
  const convId = await getOrCreateProjectConversation(client, projectId);
  if (convId) {
    router.push(`/messages/${convId}`);
    return;
  }
  router.push("/messages");
}
