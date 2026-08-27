"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  CheckCircle,
  Folder,
  Image as ImageIcon,
  PlusCircle,
  Send,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import { AIAssistSheet } from "@/app/messages/_components/AIAssistSheet";
import { CollabRequestModal } from "@/app/messages/_components/CollabRequestModal";
import { ScheduleSendModal } from "@/app/messages/_components/ScheduleSendModal";
import { TaskCreateModal } from "@/app/messages/_components/TaskCreateModal";
import { VoiceRecordButton } from "@/app/messages/_components/VoiceRecorder";
import { sendMessage } from "@/lib/messages/api";
import { bindTypingChannel, broadcastTyping, unbindTypingChannel } from "@/lib/messages/typing";
import { uploadMessageFile, uploadMessageImage, uploadMessageVoice } from "@/lib/messages/upload";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import type { CollabRequestMetadata, Message, TaskCardMetadata } from "@/lib/types/messages";

type Props = {
  conversationId: string;
  senderId: string;
  senderName: string;
  replyTo: Message | null;
  chatContext?: string;
  onSent: (message: Message) => void;
  onSendComplete: () => void;
  onScheduled?: () => void;
};

export function MessageInput({
  conversationId,
  senderId,
  senderName,
  replyTo,
  chatContext,
  onSent,
  onSendComplete,
  onScheduled,
}: Props) {
  const { tx } = useI18n();
  const [text, setText] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    bindTypingChannel(supabase, conversationId, senderId, senderName);
    return () => unbindTypingChannel();
  }, [conversationId, senderId, senderName]);

  const insert = async (
    params: Parameters<typeof sendMessage>[1],
    opts?: { scheduled?: boolean },
  ) => {
    if (!supabase || sending) return;
    setSending(true);
    const msg = await sendMessage(supabase, params);
    setSending(false);
    if (msg) {
      onSent(msg);
      onSendComplete();
    } else if (opts?.scheduled) {
      onScheduled?.();
      onSendComplete();
    }
  };

  const handleSend = async (scheduledAt?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await insert(
      {
        conversationId,
        senderId,
        content: trimmed,
        replyToId: replyTo?.id,
        scheduledAt,
      },
      { scheduled: Boolean(scheduledAt) },
    );
    if (!scheduledAt) setText("");
  };

  const sendVoice = async (blob: Blob, duration: number, waveform: number[]) => {
    if (!supabase) return;
    try {
      const url = await uploadMessageVoice(supabase, senderId, conversationId, blob);
      await insert({
        conversationId,
        senderId,
        contentType: "voice",
        metadata: { url, duration_seconds: duration, waveform },
        replyToId: replyTo?.id,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : tx("送信に失敗しました", "Failed to send"));
    }
  };

  const onImagePicked = async (file: File | undefined) => {
    if (!file || !supabase) return;
    try {
      const { url, width, height } = await uploadMessageImage(supabase, senderId, conversationId, file);
      await insert({
        conversationId,
        senderId,
        contentType: "image",
        metadata: { url, width, height },
        replyToId: replyTo?.id,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : tx("画像送信に失敗", "Failed to send image"));
    }
  };

  const onFilePicked = async (file: File | undefined) => {
    if (!file || !supabase) return;
    try {
      const meta = await uploadMessageFile(supabase, senderId, conversationId, file);
      await insert({
        conversationId,
        senderId,
        content: meta.filename,
        contentType: "file",
        metadata: meta,
        replyToId: replyTo?.id,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : tx("ファイル送信に失敗", "Failed to send file"));
    }
  };

  const extras = [
    { id: "photo", icon: ImageIcon, label: tx("写真", "Photo"), action: () => imageRef.current?.click() },
    { id: "camera", icon: Camera, label: tx("カメラ", "Camera"), action: () => imageRef.current?.click() },
    { id: "file", icon: Folder, label: tx("ファイル", "File"), action: () => fileRef.current?.click() },
    { id: "collab", icon: UserPlus, label: tx("コラボ依頼", "Collab request"), action: () => setShowCollab(true) },
    { id: "task", icon: CheckCircle, label: tx("タスク作成", "Create task"), action: () => setShowTask(true) },
    {
      id: "milestone",
      icon: Trophy,
      label: tx("実績シェア", "Share milestone"),
      action: () =>
        void insert({
          conversationId,
          senderId,
          contentType: "milestone_share",
          metadata: {
            title: tx("マイルストーン達成！", "Milestone achieved!"),
            type: "badge",
            milestone_id: "local",
            achieved_at: new Date().toISOString(),
          },
          replyToId: replyTo?.id,
        }),
    },
    { id: "schedule", icon: Calendar, label: tx("予定送信", "Schedule send"), action: () => setShowSchedule(true) },
    { id: "ai", icon: Sparkles, label: tx("AI文章補助", "AI writing help"), action: () => setShowAi(true) },
  ] as const;

  return (
    <div className="border-t border-zinc-100 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onImagePicked(e.target.files?.[0])} />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => void onFilePicked(e.target.files?.[0])} />

      {showExtras ? (
        <div className="mb-2 grid grid-cols-4 gap-2 px-1">
          {extras.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.action();
                setShowExtras(false);
              }}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100">
                <item.icon className="h-5 w-5 text-zinc-600" />
              </div>
              <span className="text-[10px] text-zinc-500">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button type="button" onClick={() => setShowExtras((v) => !v)} className="flex h-9 w-9 shrink-0 items-center justify-center" aria-label={tx("添付", "Attach")}>
          <PlusCircle className={`h-7 w-7 transition-transform ${showExtras ? "rotate-45 text-violet-600" : "text-zinc-500"}`} />
        </button>
        <div className="max-h-[120px] min-h-[40px] flex-1 overflow-y-auto rounded-2xl bg-zinc-100 px-4 py-2.5">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              broadcastTyping(senderName);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={tx("メッセージを入力", "Type a message")}
            className="w-full resize-none bg-transparent text-base outline-none sm:text-sm"
            rows={1}
          />
        </div>
        {text.trim() ? (
          <button type="button" onClick={() => void handleSend()} disabled={sending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 disabled:opacity-50" aria-label={tx("送信", "Send")}>
            <Send className="h-4 w-4 text-white" />
          </button>
        ) : (
          <VoiceRecordButton onStop={(blob, duration, waveform) => void sendVoice(blob, duration, waveform)} />
        )}
      </div>

      {showCollab ? (
        <CollabRequestModal
          onClose={() => setShowCollab(false)}
          onSubmit={(metadata: CollabRequestMetadata) => {
            setShowCollab(false);
            void insert({
              conversationId,
              senderId,
              contentType: "collab_request",
              metadata: metadata as unknown as Record<string, unknown>,
              replyToId: replyTo?.id,
            });
          }}
        />
      ) : null}
      {showTask ? (
        <TaskCreateModal
          onClose={() => setShowTask(false)}
          onSubmit={(metadata: TaskCardMetadata) => {
            setShowTask(false);
            void insert({
              conversationId,
              senderId,
              contentType: "task_card",
              metadata: metadata as unknown as Record<string, unknown>,
              replyToId: replyTo?.id,
            });
          }}
        />
      ) : null}
      {showAi ? (
        <AIAssistSheet
          draft={text}
          context={chatContext}
          onClose={() => setShowAi(false)}
          onApply={(t) => setText(t)}
        />
      ) : null}
      {showSchedule ? (
        <ScheduleSendModal
          onClose={() => setShowSchedule(false)}
          onSchedule={(iso) => {
            setShowSchedule(false);
            void handleSend(iso);
          }}
        />
      ) : null}
    </div>
  );
}
