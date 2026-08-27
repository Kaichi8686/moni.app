import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDirectConversation } from "@/lib/messages/api";

type RouterPush = { push: (href: string) => void };

/** 1対1 DM を開く（新メッセージ）。失敗時はインボックスへ */
export async function navigateToDirectMessage(
  client: SupabaseClient,
  router: RouterPush,
  peerUserId: string,
): Promise<void> {
  const convId = await getOrCreateDirectConversation(client, peerUserId);
  if (convId) {
    router.push(`/messages/${convId}`);
    return;
  }
  router.push("/messages");
}
