import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboxConversation, Message, MessageContentType } from "@/lib/types/messages";
import { mapInboxRow, mapMessageRow, profileToSender } from "@/lib/messages/mappers";

export async function getOrCreateDirectConversation(
  client: SupabaseClient,
  otherUserId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("get_or_create_direct_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error) {
    console.error("get_or_create_direct_conversation", error);
    return null;
  }
  return data as string;
}

export async function fetchInboxConversations(
  client: SupabaseClient,
  userId: string,
): Promise<InboxConversation[]> {
  const { data: memberships, error: memErr } = await client
    .from("conversation_members")
    .select("conversation_id, last_read_at, is_pinned")
    .eq("user_id", userId);

  if (memErr || !memberships?.length) return [];

  const convIds = memberships.map((m) => m.conversation_id as string);
  const readMap = new Map(
    memberships.map((m) => [m.conversation_id as string, m.last_read_at as string]),
  );
  const pinnedMap = new Map(
    memberships.map((m) => [m.conversation_id as string, Boolean(m.is_pinned)]),
  );

  const { data: convs, error: convErr } = await client
    .from("conversations")
    .select("id, type, name, icon_emoji, project_id, last_message_at")
    .in("id", convIds)
    .order("last_message_at", { ascending: false });

  if (convErr || !convs?.length) return [];

  const { data: lastMessages } = await client
    .from("messages")
    .select("id, conversation_id, sender_id, content, content_type, is_deleted, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false });

  type LastMsgRow = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string | null;
    content_type: MessageContentType;
    is_deleted: boolean;
    created_at: string;
  };
  const lastByConv = new Map<string, LastMsgRow>();
  for (const msg of (lastMessages ?? []) as LastMsgRow[]) {
    const cid = msg.conversation_id;
    if (!lastByConv.has(cid)) lastByConv.set(cid, msg);
  }

  const { data: allMembers } = await client
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds);

  const membersByConv = new Map<string, string[]>();
  for (const m of allMembers ?? []) {
    const cid = m.conversation_id as string;
    const list = membersByConv.get(cid) ?? [];
    list.push(m.user_id as string);
    membersByConv.set(cid, list);
  }

  const peerIds = new Set<string>();
  for (const c of convs) {
    if (c.type === "direct") {
      const members = membersByConv.get(c.id as string) ?? [];
      const other = members.find((id) => id !== userId);
      if (other) peerIds.add(other);
    }
  }

  const profileIds = [...peerIds];
  const { data: profiles } = profileIds.length
    ? await client.from("profiles").select("id, display_name, avatar_url").in("id", profileIds)
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, profileToSender(p)]));

  const unreadCounts = await Promise.all(
    convIds.map(async (cid) => {
      const lastRead = readMap.get(cid) ?? new Date(0).toISOString();
      const { count } = await client
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", cid)
        .gt("created_at", lastRead)
        .neq("sender_id", userId)
        .eq("is_deleted", false);
      return [cid, count ?? 0] as const;
    }),
  );
  const unreadMap = new Map(unreadCounts);

  return convs.map((c) => {
    const id = c.id as string;
    const last = lastByConv.get(id);
    const members = membersByConv.get(id) ?? [];
    const otherId = members.find((mid) => mid !== userId);

    return mapInboxRow(c, {
      unreadCount: unreadMap.get(id) ?? 0,
      isPinned: pinnedMap.get(id) ?? false,
      otherUser: c.type === "direct" && otherId ? profileMap.get(otherId) : undefined,
      memberCount: members.length,
      lastMessage: last
        ? {
            content: (last.content as string | null) ?? undefined,
            contentType: last.content_type as MessageContentType,
            isDeleted: Boolean(last.is_deleted),
            senderId: last.sender_id as string,
          }
        : undefined,
    });
  });
}

export async function fetchConversationMessages(
  client: SupabaseClient,
  conversationId: string,
): Promise<Message[]> {
  const now = new Date().toISOString();
  const { data: rows, error } = await client
    .from("messages")
    .select(
      "id, conversation_id, sender_id, content, content_type, metadata, reply_to_id, is_edited, is_deleted, pinned_at, scheduled_at, created_at",
    )
    .eq("conversation_id", conversationId)
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) return [];

  const senderIds = [...new Set(rows.map((r) => r.sender_id as string))];
  const { data: profiles } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", senderIds);

  const senderMap = new Map((profiles ?? []).map((p) => [p.id as string, profileToSender(p)]));

  const messageIds = rows.map((r) => r.id as string);
  const { data: reactionRows } = await client
    .from("message_reactions")
    .select("message_id, user_id, emoji, created_at")
    .in("message_id", messageIds);

  const reactionsByMessage = new Map<string, Message["reactions"]>();
  for (const r of reactionRows ?? []) {
    const mid = r.message_id as string;
    const list = reactionsByMessage.get(mid) ?? [];
    list.push({
      messageId: mid,
      userId: r.user_id as string,
      emoji: r.emoji as string,
      createdAt: r.created_at as string,
    });
    reactionsByMessage.set(mid, list);
  }

  const byId = new Map<string, Message>();
  const mapped: Message[] = [];

  for (const row of rows) {
    const sender = senderMap.get(row.sender_id as string) ?? {
      id: row.sender_id as string,
      displayName: "ユーザー",
    };
    const msg = mapMessageRow(
      row,
      sender,
      reactionsByMessage.get(row.id as string) ?? [],
    );
    byId.set(msg.id, msg);
    mapped.push(msg);
  }

  for (const msg of mapped) {
    if (msg.replyToId) {
      msg.replyTo = byId.get(msg.replyToId);
    }
  }

  return mapped;
}

export async function markConversationRead(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<void> {
  await client
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

export async function sendMessage(
  client: SupabaseClient,
  params: {
    conversationId: string;
    senderId: string;
    content?: string;
    replyToId?: string;
    contentType?: MessageContentType;
    metadata?: Record<string, unknown>;
    scheduledAt?: string;
  },
): Promise<Message | null> {
  const { data, error } = await client
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      sender_id: params.senderId,
      content: params.content ?? null,
      content_type: params.contentType ?? "text",
      metadata: params.metadata ?? {},
      reply_to_id: params.replyToId ?? null,
      scheduled_at: params.scheduledAt ?? null,
    })
    .select(
      "id, conversation_id, sender_id, content, content_type, metadata, reply_to_id, is_edited, is_deleted, pinned_at, scheduled_at, created_at",
    )
    .single();

  if (error || !data) {
    console.error("sendMessage", error);
    return null;
  }

  if (params.scheduledAt && new Date(params.scheduledAt) > new Date()) {
    return null;
  }

  const { data: profile } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", params.senderId)
    .maybeSingle();

  const sender = profile
    ? profileToSender(profile)
    : { id: params.senderId, displayName: "あなた" };

  return mapMessageRow(data, sender, []);
}

/** @deprecated use sendMessage */
export const sendTextMessage = (
  client: SupabaseClient,
  params: {
    conversationId: string;
    senderId: string;
    content: string;
    replyToId?: string;
    contentType?: MessageContentType;
    metadata?: Record<string, unknown>;
  },
) => sendMessage(client, { ...params, content: params.content });

export async function updateMessageMetadata(
  client: SupabaseClient,
  messageId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await client.from("messages").update({ metadata }).eq("id", messageId);
  return !error;
}

export async function fetchMemberReadMap(
  client: SupabaseClient,
  conversationId: string,
): Promise<Map<string, string>> {
  const { data } = await client
    .from("conversation_members")
    .select("user_id, last_read_at")
    .eq("conversation_id", conversationId);
  return new Map((data ?? []).map((r) => [r.user_id as string, r.last_read_at as string]));
}

export async function ensureInviteCode(client: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data, error } = await client.rpc("ensure_conversation_invite_code", {
    p_conversation_id: conversationId,
  });
  if (error) {
    console.error("ensure_invite_code", error);
    return null;
  }
  return data as string;
}

export async function joinByInviteCode(client: SupabaseClient, code: string): Promise<string | null> {
  const { data, error } = await client.rpc("join_conversation_by_invite", { p_invite_code: code });
  if (error) {
    console.error("join_by_invite", error);
    return null;
  }
  return data as string;
}

export async function softDeleteMessage(client: SupabaseClient, messageId: string): Promise<boolean> {
  const { error } = await client.from("messages").update({ is_deleted: true }).eq("id", messageId);
  return !error;
}

export async function editMessageText(
  client: SupabaseClient,
  messageId: string,
  content: string,
): Promise<boolean> {
  const { error } = await client
    .from("messages")
    .update({ content, is_edited: true, updated_at: new Date().toISOString() })
    .eq("id", messageId);
  return !error;
}

export async function toggleReaction(
  client: SupabaseClient,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await client
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await client
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
  } else {
    await client.from("message_reactions").insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });
  }
}

export async function pinMessage(
  client: SupabaseClient,
  messageId: string,
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const { data: pinned } = await client
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .not("pinned_at", "is", null);

  if ((pinned?.length ?? 0) >= 3) return false;

  const { error } = await client
    .from("messages")
    .update({ pinned_at: new Date().toISOString(), pinned_by: userId })
    .eq("id", messageId);

  return !error;
}

export async function fetchPinnedMessages(
  client: SupabaseClient,
  conversationId: string,
): Promise<Message[]> {
  const all = await fetchConversationMessages(client, conversationId);
  return all.filter((m) => m.pinnedAt && !m.isDeleted);
}

export async function fetchConversationHeader(
  client: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<{
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  memberCount: number;
  otherUserId?: string;
} | null> {
  const { data: conv } = await client
    .from("conversations")
    .select("id, type, name, icon_emoji")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return null;

  const { data: members } = await client
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const count = memberIds.length;

  if (conv.type === "direct") {
    const otherId = memberIds.find((id) => id !== userId);
    if (!otherId) return { id: conversationId, title: "メッセージ", type: conv.type as string, memberCount: count };
    const { data: profile } = await client
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", otherId)
      .maybeSingle();
    const name = profile ? profileToSender(profile).displayName : "ユーザー";
    return { id: conversationId, title: name, type: conv.type as string, memberCount: count, otherUserId: otherId };
  }

  return {
    id: conversationId,
    title: (conv.name as string | null)?.trim() || "グループ",
    subtitle: `${count}人`,
    type: conv.type as string,
    memberCount: count,
  };
}
