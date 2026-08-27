import type { SupabaseClient } from "@supabase/supabase-js";

/** DM room_id: dm|{smaller uuid}|{larger uuid} */
export function buildDmRoomId(userId: string, peerId: string): string {
  const [peer_a, peer_b] = userId < peerId ? [userId, peerId] : [peerId, userId];
  return `dm|${peer_a}|${peer_b}`;
}

/** @deprecated navigateToDirectMessage を使う。互換用に新メッセージ URL を返す */
export function buildTalkUrlForPeer(peerUserId: string): string {
  const params = new URLSearchParams({ peer: peerUserId });
  return `/messages?${params.toString()}`;
}

/** 1対1トーク用ルームを確保して room_id を返す */
export async function ensureDmRoom(
  client: SupabaseClient,
  currentUserId: string,
  peerUserId: string,
): Promise<string> {
  if (currentUserId === peerUserId) {
    throw new Error("自分自身とはトークできません");
  }
  const [peer_a, peer_b] = currentUserId < peerUserId ? [currentUserId, peerUserId] : [peerUserId, currentUserId];
  const room_id = `dm|${peer_a}|${peer_b}`;

  const { data: existing } = await client.from("chat_dm_rooms").select("room_id").eq("room_id", room_id).maybeSingle();
  if (existing?.room_id) return room_id;

  const { error } = await client.from("chat_dm_rooms").insert({ room_id, peer_a, peer_b });
  if (error) {
    if (error.code === "23505") return room_id;
    throw new Error(error.message);
  }
  return room_id;
}
