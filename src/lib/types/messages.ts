export type MessageContentType =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "file"
  | "collab_request"
  | "task_card"
  | "milestone_share"
  | "system";

export type ConversationType = "direct" | "group" | "project";

export interface ImageMetadata {
  url: string;
  width: number;
  height: number;
  thumbnail_url?: string;
}

export interface VoiceMetadata {
  url: string;
  duration_seconds: number;
  waveform: number[];
}

export interface FileMetadata {
  url: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
}

export interface CollabRequestMetadata {
  title: string;
  project_name: string;
  project_id: string;
  skill_needed: string;
  duration: string;
  compensation: string;
  status: "pending" | "accepted" | "declined";
}

export interface TaskCardMetadata {
  task_id?: string;
  title: string;
  phase_id?: string;
  assignee_id?: string;
  due_date?: string;
  status: "pending_create" | "created";
}

export interface MilestoneShareMetadata {
  milestone_id: string;
  title: string;
  type: string;
  achieved_at: string;
}

export type MessageMetadata = Record<string, unknown>;

export type MessageReaction = {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
};

export type MessageSender = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  contentType: MessageContentType;
  metadata: MessageMetadata;
  replyToId?: string;
  replyTo?: Message;
  isEdited: boolean;
  isDeleted: boolean;
  pinnedAt?: string;
  scheduledAt?: string;
  createdAt: string;
  reactions: MessageReaction[];
  sender: MessageSender;
};

export type InboxConversation = {
  id: string;
  type: ConversationType;
  name: string | null;
  iconEmoji: string;
  projectId: string | null;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  otherUser?: MessageSender;
  memberCount?: number;
  lastMessage?: {
    content?: string;
    contentType: MessageContentType;
    isDeleted: boolean;
    senderId: string;
  };
};
