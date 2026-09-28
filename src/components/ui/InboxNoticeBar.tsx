"use client";

import {
  AlertTriangle,
  Bell,
  ChevronRight,
  MessageCircle,
  UserPlus,
  X,
} from "lucide-react";

export type InboxNoticeItem = {
  id: string;
  level: "info" | "warn";
  text: string;
  kind?: "aggregate" | "project";
};

type Props<T extends InboxNoticeItem> = {
  items: T[];
  fullBleed?: boolean;
  onOpen: (item: T) => void;
  onDismiss: (id: string) => void;
};

function noticeIcon(item: InboxNoticeItem) {
  if (item.id === "chat-unread") return MessageCircle;
  if (item.id === "follow-request") return UserPlus;
  if (item.id === "report-new") return AlertTriangle;
  return Bell;
}

function isActionable(item: InboxNoticeItem) {
  return item.kind === "project" || item.id === "follow-request";
}

function noticeHint(item: InboxNoticeItem) {
  if (item.kind === "project") return "タップして確認";
  if (item.id === "follow-request") return "フォローリクエストを確認";
  if (item.id === "chat-unread") return "タップで非表示";
  if (item.id === "report-new") return "タップで非表示";
  return "タップで非表示";
}

export function InboxNoticeBar<T extends InboxNoticeItem>({
  items,
  fullBleed = false,
  onOpen,
  onDismiss,
}: Props<T>) {
  if (items.length === 0) return null;

  return (
    <div
      className={
        fullBleed
          ? "shrink-0 border-b border-zinc-100 bg-white"
          : "overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      }
      role="region"
      aria-label="お知らせ"
    >
      <ul className="divide-y divide-zinc-100">
        {items.map((item, index) => {
          const Icon = noticeIcon(item);
          const actionable = isActionable(item);
          const warn = item.level === "warn";

          return (
            <li
              key={item.id}
              className="inbox-notice-row flex items-stretch"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <button
                type="button"
                className="flex min-h-[48px] min-w-0 flex-1 touch-manipulation items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                onClick={() => onOpen(item)}
                title={noticeHint(item)}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    warn ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-800"
                  }`}
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug tracking-tight text-zinc-900">
                  {item.text}
                </span>
                {actionable ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                ) : null}
              </button>
              <button
                type="button"
                className="flex w-11 shrink-0 touch-manipulation items-center justify-center text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 active:bg-zinc-100"
                onClick={() => onDismiss(item.id)}
                aria-label="このお知らせを閉じる"
                title="閉じる"
              >
                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
