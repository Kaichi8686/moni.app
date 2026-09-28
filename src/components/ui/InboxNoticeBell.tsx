"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  return item.kind === "project" || item.id === "follow-request" || item.id === "chat-unread";
}

export function InboxNoticeBell<T extends InboxNoticeItem>({ items, onOpen, onDismiss }: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const count = items.length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (count === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="relative flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100 active:bg-zinc-200"
        aria-label={`お知らせ ${count}件`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-[20px] w-[20px]" strokeWidth={1.75} aria-hidden />
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="お知らせ一覧"
          className="inbox-notice-panel absolute right-0 top-[calc(100%+6px)] z-40 w-[min(20.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold tracking-tight text-zinc-900">お知らせ</p>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <ul className="max-h-[min(60vh,22rem)] divide-y divide-zinc-100 overflow-y-auto">
            {items.map((item, index) => {
              const Icon = noticeIcon(item);
              const actionable = isActionable(item);
              const warn = item.level === "warn";
              return (
                <li
                  key={item.id}
                  className="inbox-notice-row flex items-stretch"
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <button
                    type="button"
                    className="flex min-h-[52px] min-w-0 flex-1 touch-manipulation items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                    onClick={() => {
                      onOpen(item);
                      if (actionable) setOpen(false);
                    }}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        warn ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-800"
                      }`}
                      aria-hidden
                    >
                      <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
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
                    className="flex w-10 shrink-0 touch-manipulation items-center justify-center text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 active:bg-zinc-100"
                    onClick={() => onDismiss(item.id)}
                    aria-label="このお知らせを閉じる"
                    title="閉じる"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
