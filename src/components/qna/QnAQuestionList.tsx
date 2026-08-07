"use client";

import { CheckCircle2, CircleDashed, MessageCircle } from "lucide-react";
import { QNA_CATEGORIES, qnaCategoryLabel, type QnaCategoryId } from "@/lib/qna/categories";
import type { QnaListFilter, QnaQuestion } from "@/lib/qna/types";
import { avatarInitial, avatarToneFromName } from "@/lib/ui/avatarTone";

const PANEL = "rounded-lg border border-zinc-200 bg-white";
const AVATAR =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-[12px] font-bold text-white";

type Props = {
  questions: QnaQuestion[];
  loading: boolean;
  filter: QnaListFilter;
  formatTime: (iso: string) => string;
  onFilterChange: (next: QnaListFilter) => void;
  onOpen: (id: string) => void;
};

export function QnAQuestionList({
  questions,
  loading,
  filter,
  formatTime,
  onFilterChange,
  onOpen,
}: Props) {
  const filtered = questions.filter((q) => {
    if (filter.category !== "all" && q.category !== filter.category) return false;
    if (filter.unresolvedOnly && q.bestAnswerId) return false;
    return true;
  });

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-3">
        <h4 className="text-[15px] font-semibold tracking-tight text-zinc-900">みんなの質問</h4>
        <p className="mt-0.5 text-[12px] text-zinc-500">カテゴリで絞り込み、未解決から答えてみよう</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onFilterChange({ ...filter, category: "all" })}
          className={`min-h-[32px] rounded-full border px-2.5 text-[11px] font-semibold transition ${
            filter.category === "all"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          すべて
        </button>
        {QNA_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onFilterChange({ ...filter, category: c.id as QnaCategoryId })}
            className={`min-h-[32px] rounded-full border px-2.5 text-[11px] font-semibold transition ${
              filter.category === c.id
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onFilterChange({ ...filter, unresolvedOnly: !filter.unresolvedOnly })}
          className={`min-h-[32px] rounded-full border px-2.5 text-[11px] font-semibold transition ${
            filter.unresolvedOnly
              ? "border-amber-700/40 bg-amber-50 text-amber-900"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          未解決のみ
        </button>
      </div>

      {loading ? (
        <p className={`${PANEL} px-4 py-8 text-center text-sm text-zinc-500`}>読み込み中…</p>
      ) : filtered.length === 0 ? (
        <div className={`${PANEL} border-dashed px-4 py-10 text-center`}>
          <p className="text-sm font-medium text-zinc-700">該当する質問がありません。</p>
          <p className="mt-1.5 text-xs text-zinc-500">フィルタを変えるか、新しい質問を投稿してみよう。</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((q) => {
            const resolved = Boolean(q.bestAnswerId);
            const activityIso = q.lastReplyAtIso || q.createdAtIso;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  className={`group flex w-full gap-3 ${PANEL} p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50/80 active:bg-zinc-50 sm:p-4`}
                  onClick={() => onOpen(q.id)}
                >
                  <div
                    className={`${AVATAR} h-9 w-9`}
                    style={{ backgroundColor: avatarToneFromName(q.authorName) }}
                  >
                    {avatarInitial(q.authorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                          resolved
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        {resolved ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                        ) : (
                          <CircleDashed className="h-3 w-3" aria-hidden />
                        )}
                        {resolved ? "解決済み" : "未解決"}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        <span className="font-medium text-zinc-600">{q.authorName}</span>
                        <span className="mx-1">·</span>
                        {formatTime(q.createdAtIso)}
                      </span>
                    </div>
                    <h5 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight text-zinc-900">
                      {q.title.trim()}
                    </h5>
                    <div className="mt-1.5">
                      <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        {qnaCategoryLabel(q.category)}
                      </span>
                    </div>
                    {q.body.trim() ? (
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-600">
                        {q.body.trim()}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        <span className="tabular-nums">{q.answerCount}</span>
                        <span>返信</span>
                      </span>
                      {q.lastReplyAtIso ? (
                        <span>
                          最終返信 <time dateTime={activityIso}>{formatTime(activityIso)}</time>
                        </span>
                      ) : (
                        <span className="text-zinc-400">まだ返信なし</span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
