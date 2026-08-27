"use client";

import type { FormEvent, RefObject } from "react";
import { Code2, HelpCircle, Lightbulb, ListChecks, type LucideIcon } from "lucide-react";
import { QNA_CATEGORIES, qnaCategoryLabel, type QnaCategoryId } from "@/lib/qna/categories";
import { useI18n } from "@/lib/i18n/I18nProvider";

const PANEL = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";
const FIELD =
  "w-full border-0 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500";

const CATEGORY_ICONS: Record<QnaCategoryId, LucideIcon> = {
  howto: ListChecks,
  tech: Code2,
  idea: Lightbulb,
  other: HelpCircle,
};

type Props = {
  title: string;
  body: string;
  category: QnaCategoryId;
  titleRef: RefObject<HTMLInputElement | null>;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onCategoryChange: (v: QnaCategoryId) => void;
  onSubmit: (e?: FormEvent) => void;
};

export function QnAComposer({
  title,
  body,
  category,
  titleRef,
  onTitleChange,
  onBodyChange,
  onCategoryChange,
  onSubmit,
}: Props) {
  const { tx, locale } = useI18n();
  const canSubmit = Boolean(title.trim());
  const CategoryIcon = CATEGORY_ICONS[category];

  return (
    <form className={`${PANEL} mx-4 mt-4 shrink-0 overflow-hidden`} onSubmit={onSubmit}>
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
          {tx("あなたの質問", "Your question")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QNA_CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                className={`min-h-[32px] rounded-full border px-3 text-[12px] font-semibold transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-indigo-500 dark:bg-indigo-500"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                }`}
              >
                {qnaCategoryLabel(c.id, locale)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        <div
          className="mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300"
          aria-hidden
        >
          <CategoryIcon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
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
              placeholder={tx("背景・試したこと・聞きたいポイント（任意）", "Background, what you tried, what you need (optional)")}
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
              {tx("質問する", "Ask")}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
