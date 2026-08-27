"use client";

import { useState } from "react";
import { differenceInMinutes, format } from "date-fns";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { ReadReceipt } from "@/components/messages/ReadReceipt";
import { useLongPress } from "@/hooks/useLongPress";
import { useSwipeReply } from "@/hooks/useSwipeReply";
import { MessageActionSheet } from "@/app/messages/_components/MessageActionSheet";
import { ReactionPicker } from "@/app/messages/_components/ReactionPicker";
import { CollabRequestCard } from "@/app/messages/_components/CollabRequestCard";
import { TaskCreateCard } from "@/app/messages/_components/TaskCreateCard";
import { VoiceMessagePlayer } from "@/app/messages/_components/VoiceMessagePlayer";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CollabRequestMetadata, Message, TaskCardMetadata, VoiceMetadata } from "@/lib/types/messages";

type Reader = { id: string; displayName: string; avatarUrl?: string | null };

type Props = {
  message: Message;
  prevMessage?: Message;
  currentUserId: string | null;
  readBy?: Reader[];
  onReply: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTranslate?: () => void;
  onCollabRespond?: (status: "accepted" | "declined") => void;
};

function ReactionDisplay({
  reactions,
  onToggle,
}: {
  reactions: Message["reactions"];
  onToggle: (emoji: string) => void;
}) {
  const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {Object.entries(grouped).map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className="rounded-full border border-zinc-100 bg-white px-1.5 py-0.5 text-xs shadow-sm"
        >
          {emoji} {count > 1 ? count : ""}
        </button>
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  prevMessage,
  currentUserId,
  readBy = [],
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  onTranslate,
  onCollabRespond,
}: Props) {
  const { tx } = useI18n();
  const isMine = message.senderId === currentUserId;
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const showAvatar =
    !isMine &&
    (!prevMessage ||
      prevMessage.senderId !== message.senderId ||
      differenceInMinutes(new Date(message.createdAt), new Date(prevMessage.createdAt)) > 5);

  const longPress = useLongPress(() => {
    setShowActions(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(50);
  });

  const swipe = useSwipeReply(onReply);

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <span className="rounded-2xl bg-zinc-100 px-3 py-2 text-xs italic text-zinc-400">{tx("メッセージを取り消しました", "Message unsent")}</span>
      </div>
    );
  }

  const voiceMeta = message.metadata as unknown as VoiceMetadata;

  return (
    <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`} {...swipe}>
      {!isMine ? (
        <div className="h-7 w-7 shrink-0">
          {showAvatar ? (
            <MemberAvatarBubble
              userId={message.sender.id}
              name={message.sender.displayName}
              avatarUrl={message.sender.avatarUrl}
              size="sm"
              className="!h-7 !w-7 !text-xs"
            />
          ) : null}
        </div>
      ) : null}

      <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {showAvatar && !isMine ? (
          <span className="mb-1 pl-1 text-xs text-zinc-500">{message.sender.displayName}</span>
        ) : null}

        {message.replyTo ? (
          <div
            className={`mb-1 max-w-full truncate rounded-xl px-3 py-1.5 text-xs ${
              isMine ? "bg-violet-100 text-violet-700" : "bg-zinc-200 text-zinc-600"
            }`}
          >
            <p className="font-medium">{message.replyTo.sender?.displayName}</p>
            <p className="truncate">{message.replyTo.content}</p>
          </div>
        ) : null}

        <div
          {...longPress}
          className={`relative cursor-pointer select-none rounded-2xl px-4 py-2.5 ${
            isMine
              ? "rounded-br-md bg-violet-600 text-white"
              : "rounded-bl-md border border-zinc-100 bg-white text-zinc-900 shadow-sm"
          }`}
        >
          {message.contentType === "text" ? (
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
          ) : null}
          {message.contentType === "image" && typeof message.metadata.url === "string" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.metadata.url} alt="" className="max-w-full rounded-xl" />
          ) : null}
          {message.contentType === "voice" && typeof voiceMeta.url === "string" ? (
            <VoiceMessagePlayer
              url={voiceMeta.url}
              duration={voiceMeta.duration_seconds ?? 0}
              waveform={voiceMeta.waveform ?? []}
              isMine={isMine}
            />
          ) : null}
          {message.contentType === "file" && typeof message.metadata.url === "string" ? (
            <a
              href={message.metadata.url as string}
              target="_blank"
              rel="noreferrer"
              className={`text-sm underline ${isMine ? "text-violet-100" : "text-violet-600"}`}
            >
              📎 {(message.metadata.filename as string) || tx("ファイル", "File")}
            </a>
          ) : null}
          {message.contentType === "collab_request" ? (
            <CollabRequestCard
              metadata={message.metadata as unknown as CollabRequestMetadata}
              isMine={isMine}
              onRespond={onCollabRespond}
            />
          ) : null}
          {message.contentType === "task_card" ? (
            <TaskCreateCard metadata={message.metadata as unknown as TaskCardMetadata} isMine={isMine} />
          ) : null}
          {message.contentType === "milestone_share" ? (
            <p className="text-sm">🏆 {(message.metadata.title as string) || tx("実績をシェア", "Share a milestone")}</p>
          ) : null}
          {message.isEdited ? (
            <span className={`text-xs ${isMine ? "text-violet-200" : "text-zinc-400"}`}> {tx("編集済み", "Edited")}</span>
          ) : null}
        </div>

        <div className={`mt-0.5 flex items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-xs text-zinc-400">{format(new Date(message.createdAt), "HH:mm")}</span>
          {isMine ? <ReadReceipt readers={readBy} /> : null}
        </div>

        {message.reactions.length > 0 ? (
          <ReactionDisplay reactions={message.reactions} onToggle={onReact} />
        ) : null}
      </div>

      {showActions ? (
        <MessageActionSheet
          message={message}
          isMine={isMine}
          onReply={onReply}
          onReact={onReact}
          onMoreReactions={() => {
            setShowActions(false);
            setShowReactionPicker(true);
          }}
          onPin={onPin}
          onEdit={onEdit}
          onDelete={onDelete}
          onTranslate={onTranslate}
          onClose={() => setShowActions(false)}
        />
      ) : null}

      {showReactionPicker ? (
        <ReactionPicker
          onSelect={(emoji) => {
            onReact(emoji);
            setShowReactionPicker(false);
          }}
          onClose={() => setShowReactionPicker(false)}
        />
      ) : null}
    </div>
  );
}
