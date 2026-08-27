import type {
  InboxConversation,
  Message,
  MessageContentType,
  MessageReaction,
  MessageSender,
} from "@/lib/types/messages";

type ProfileRow = { id: string; display_name: string | null; avatar_url?: string | null };

export function profileToSender(p: ProfileRow): MessageSender {
  return {
    id: p.id,
    displayName: (p.display_name?.trim() || "ユーザー") as string,
    avatarUrl: p.avatar_url ?? null,
  };
}

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  content_type: MessageContentType;
  metadata: Record<string, unknown> | null;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  pinned_at: string | null;
  scheduled_at: string | null;
  created_at: string;
};

export function mapMessageRow(
  row: MessageRow,
  sender: MessageSender,
  reactions: MessageReaction[] = [],
  replyTo?: Message,
): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content ?? undefined,
    contentType: row.content_type,
    metadata: (row.metadata ?? {}) as Message["metadata"],
    replyToId: row.reply_to_id ?? undefined,
    replyTo,
    isEdited: row.is_edited,
    isDeleted: row.is_deleted,
    pinnedAt: row.pinned_at ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    createdAt: row.created_at,
    reactions,
    sender,
  };
}

type ConversationRow = {
  id: string;
  type: InboxConversation["type"];
  name: string | null;
  icon_emoji: string | null;
  project_id: string | null;
  last_message_at: string;
};

export function mapInboxRow(
  row: ConversationRow,
  extras: Omit<InboxConversation, "id" | "type" | "name" | "iconEmoji" | "projectId" | "lastMessageAt">,
): InboxConversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    iconEmoji: row.icon_emoji ?? "💬",
    projectId: row.project_id,
    lastMessageAt: row.last_message_at,
    ...extras,
  };
}
