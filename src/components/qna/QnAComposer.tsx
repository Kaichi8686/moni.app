"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { QNA_CATEGORIES, type QnaCategoryId } from "@/lib/qna/categories";

const PANEL = "rounded-lg border border-zinc-200 bg-white";
const FIELD =
  "w-full border-0 bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400";

type Props = {
  title: string;
  body: string;
  category: QnaCategoryId;
  titleRef: RefObject<HTMLInputElement | null>;
  avatarSlot: ReactNode;
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
  avatarSlot,
  onTitleChange,
  onBodyChange,
  onCategoryChange,
  onSubmit,
}: Props) {
  const canSubmit = Boolean(title.trim());

  return (
    <form className={`${PANEL} mx-4 mt-4 shrink-0 overflow-hidden`} onSubmit={onSubmit}>
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">あなたの質問</p>
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
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 px-4 py-4">
        {avatarSlot}
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 focus-within:border-zinc-400 focus-within:bg-white">
            <input
              ref={titleRef}
              id="idea-chie-compose-title"
              aria-label="質問タイトル"
              className={`${FIELD} border-b border-zinc-200 px-3 py-2.5 text-[15px] font-semibold placeholder:font-medium`}
              placeholder="いま何で困っている？"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
            <textarea
              id="idea-chie-compose-body"
              aria-label="質問の詳細"
              className={`${FIELD} min-h-[88px] resize-none px-3 py-2.5 leading-relaxed`}
              placeholder="背景・試したこと・聞きたいポイント（任意）"
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
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "cursor-not-allowed bg-zinc-100 text-zinc-400"
              }`}
            >
              質問する
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
