import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDirectConversation } from "@/lib/messages/api";
import { markDirectConversationOpened } from "@/lib/messages/openedDirectConversations";
import { closeProjectCluster } from "@/lib/navigation/projectCluster";

type RouterPush = { push: (href: string) => void };

export type OpenDirectMessageResult =
  | { ok: true; conversationId: string }
  | { ok: false; reason: "not_mutual" | "error" };

/** 1対1 DM を開く（フォロー中／既存DM／同じプロジェクト所属）。失敗時は理由を返す */
export async function openDirectMessage(
  client: SupabaseClient,
  peerUserId: string,
): Promise<OpenDirectMessageResult> {
  return getOrCreateDirectConversation(client, peerUserId);
}

/** 1対1 DM を開く（成功時のみ会話へ。失敗時は遷移せず理由を返す） */
export async function navigateToDirectMessage(
  client: SupabaseClient,
  router: RouterPush,
  peerUserId: string,
): Promise<OpenDirectMessageResult> {
  const result = await openDirectMessage(client, peerUserId);
  if (!result.ok) return result;
  // プロフィールタブブロックのメッセージに戻す
  closeProjectCluster();
  markDirectConversationOpened(result.conversationId);
  router.push(`/messages/${result.conversationId}`);
  return result;
}
