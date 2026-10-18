import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDirectConversation } from "@/lib/messages/api";

type RouterPush = { push: (href: string) => void };

export type OpenDirectMessageResult =
  | { ok: true; conversationId: string }
  | { ok: false; reason: "not_mutual" | "error" };

/** 1対1 DM を開く（相互フォロー、または同じプロジェクト所属）。失敗時は理由を返す */
export async function openDirectMessage(
  client: SupabaseClient,
  peerUserId: string,
): Promise<OpenDirectMessageResult> {
  return getOrCreateDirectConversation(client, peerUserId);
}

/** 1対1 DM を開く（新メッセージ）。失敗時はインボックスへ */
export async function navigateToDirectMessage(
  client: SupabaseClient,
  router: RouterPush,
  peerUserId: string,
): Promise<OpenDirectMessageResult> {
  const result = await openDirectMessage(client, peerUserId);
  if (result.ok) {
    router.push(`/messages/${result.conversationId}`);
    return result;
  }
  router.push("/messages");
  return result;
}
