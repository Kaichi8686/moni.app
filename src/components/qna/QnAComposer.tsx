"use client";

import { useEffect, useState, type FormEvent, type RefObject } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

const PANEL = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";
const FIELD =
  "w-full border-0 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500";

type Props = {
  title: string;
  body: string;
  titleRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSubmit: (e?: FormEvent) => void;
  /** Increment to expand the form and focus the title. */
  focusToken?: number;
};

export function QnAComposer({
  title,
  body,
  titleRef,
  onTitleChange,
  onBodyChange,
  onSubmit,
  focusToken = 0,
}: Props) {
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  const canSubmit = Boolean(title.trim());

  useEffect(() => {
    if (focusToken > 0) {
      setOpen(true);
      window.setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [focusToken, titleRef]);

  useEffect(() => {
    if (title.trim()) setOpen(true);
  }, [title]);

  return (
    <form className={`${PANEL} mx-4 mt-1 shrink-0 overflow-hidden`} onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {tx("質問相談", "Q&A")}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? tx("入力を閉じる", "Collapse form") : tx("質問を書く", "Write a question")}
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              if (next) window.setTimeout(() => titleRef.current?.focus(), 50);
              return next;
            });
          }}
          className="inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Plus
            className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>
      </div>

      {open ? (
        <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 focus-within:border-zinc-400 focus-within:bg-white dark:border-zinc-700 dark:bg-zinc-950/40 dark:focus-within:border-zinc-500 dark:focus-within:bg-zinc-900">
            <input
              ref={titleRef}
              id="idea-chie-compose-title"
              aria-label={tx("質問タイトル", "Question title")}
              className={`${FIELD} border-b border-zinc-200 px-3 py-2.5 text-[15px] font-semibold placeholder:font-medium dark:border-zinc-700`}
              placeholder={tx("いま何で困っている？", "What’s blocking you?")}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
            <textarea
              id="idea-chie-compose-body"
              aria-label={tx("質問の詳細", "Question details")}
              className={`${FIELD} min-h-[88px] resize-none px-3 py-2.5 leading-relaxed`}
              placeholder={tx(
                "背景・試したこと・聞きたいポイント（任意）",
                "Background, what you tried, what you need (optional)",
              )}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={3}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13px] font-semibold transition ${
                canSubmit
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {tx("質問", "Ask")}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
