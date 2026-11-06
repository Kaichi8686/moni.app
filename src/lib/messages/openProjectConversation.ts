import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateProjectConversation } from "@/lib/messages/api";
import { conversationHref, mailInboxHref, writeMailProjectScope } from "@/lib/messages/mailScope";
import { openProjectCluster } from "@/lib/navigation/projectCluster";

/** プロジェクトのグループライン（メールタブ）を開く */
export async function navigateToProjectConversation(
  client: SupabaseClient,
  router: AppRouterInstance,
  projectId: string,
): Promise<void> {
  writeMailProjectScope(projectId);
  openProjectCluster();
  const convId = await getOrCreateProjectConversation(client, projectId);
  if (convId) {
    router.push(conversationHref(convId, projectId));
    return;
  }
  router.push(mailInboxHref(projectId));
}
