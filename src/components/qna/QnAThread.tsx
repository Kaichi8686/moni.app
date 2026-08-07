"use client";

import type { FormEvent, ReactNode } from "react";
import { BadgeCheck, CornerDownRight, MessageCircle } from "lucide-react";
import { QnAVoteControl } from "@/components/qna/QnAVoteControl";
import { qnaCategoryLabel } from "@/lib/qna/categories";
import type { QnaAnswer, QnaQuestion } from "@/lib/qna/types";
import { avatarInitial, avatarToneFromName } from "@/lib/ui/avatarTone";

const PANEL = "rounded-lg border border-zinc-200 bg-white";
const AVATAR =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-bold text-white";

type Props = {
  question: QnaQuestion;
  answers: QnaAnswer[];
  sessionUserId: string | null;
  answerDraft: string;
  replyToId: string | null;
  voting: boolean;
  uxReady: boolean;
  avatarSlot: ReactNode;
  formatTime: (iso: string) => string;
  onBack: () => void;
  onAnswerDraftChange: (v: string) => void;
  onReplyTo: (id: string | null) => void;
  onSubmitAnswer: (e?: FormEvent) => void;
  onPickBest: (answerId: string) => void;
  onVote: (answerId: string, value: 1 | -1) => void;
};

function sortThread(answers: QnaAnswer[], bestId: string | null): QnaAnswer[] {
  const roots = answers.filter((a) => !a.parentAnswerId);
  roots.sort((a, b) => {
    if (a.id === bestId) return -1;
    if (b.id === bestId) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime();
  });
  const children = new Map<string, QnaAnswer[]>();
  for (const a of answers) {
    if (!a.parentAnswerId) continue;
    const list = children.get(a.parentAnswerId) ?? [];
    list.push(a);
    children.set(a.parentAnswerId, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime());
  }

  const ordered: QnaAnswer[] = [];
  for (const root of roots) {
    ordered.push(root);
    for (const child of children.get(root.id) ?? []) ordered.push(child);
  }
  // Orphans (parent missing): append flat
  const placed = new Set(ordered.map((a) => a.id));
  for (const a of answers) {
    if (!placed.has(a.id)) ordered.push(a);
  }
  return ordered;
}

export function QnAThread({
  question: q,
  answers,
  sessionUserId,
  answerDraft,
  replyToId,
  voting,
  uxReady,
  avatarSlot,
  formatTime,
  onBack,
  onAnswerDraftChange,
  onReplyTo,
  onSubmitAnswer,
  onPickBest,
  onVote,
}: Props) {
  const ordered = sortThread(answers, q.bestAnswerId);
  const byId = new Map(answers.map((a) => [a.id, a]));
  const isQuestionAuthor = Boolean(sessionUserId && q.authorId === sessionUserId);
  const canAnswer = Boolean(sessionUserId && q.authorId !== sessionUserId);
  const replyParent = replyToId ? byId.get(replyToId) : null;
  const resolved = Boolean(q.bestAnswerId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-2 py-2">
        <button
          type="button"
          className="rounded-md p-2 text-zinc-900 transition hover:bg-zinc-100"
          aria-label="一覧に戻る"
          onClick={onBack}
        >
          <span className="text-lg" aria-hidden>
            ←
          </span>
        </button>
        <span className="text-[15px] font-semibold text-zinc-900">スレッド</span>
      </div>

      <article className={`m-4 ${PANEL} p-4 sm:p-5`}>
        <div className="flex gap-3">
          <div
            className={`${AVATAR} h-9 w-9 text-[12px]`}
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
                {resolved ? "解決済み" : "未解決"}
              </span>
              <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                {qnaCategoryLabel(q.category)}
              </span>
              <span className="text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-600">{q.authorName}</span>
                <span className="mx-1">·</span>
                <time dateTime={q.createdAtIso}>{formatTime(q.createdAtIso)}</time>
              </span>
            </div>
            <h4 className="mt-2 text-[16px] font-semibold leading-snug tracking-tight text-zinc-900">
              {q.title.trim()}
            </h4>
            {q.body.trim() ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-700">
                {q.body.trim()}
              </p>
            ) : null}
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-600">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums">{q.answerCount}</span>
              </span>
            </div>
          </div>
        </div>
      </article>

      <div className={`mx-4 mb-4 overflow-hidden ${PANEL}`}>
        <div className="border-b border-zinc-100 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">返信</p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {ordered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              まだ返信がありません。最初のヒントを書いてみよう。
            </li>
          ) : (
            ordered.map((a) => {
              const isBest = q.bestAnswerId === a.id;
              const isNested = Boolean(a.parentAnswerId);
              const parent = a.parentAnswerId ? byId.get(a.parentAnswerId) : null;
              const highlightMine =
                isQuestionAuthor && sessionUserId && a.authorId !== sessionUserId;

              return (
                <li
                  key={a.id}
                  className={`px-4 py-4 ${isBest ? "bg-emerald-50/40" : highlightMine ? "bg-sky-50/30" : ""} ${
                    isNested ? "pl-8 sm:pl-10" : ""
                  }`}
                >
                  {isNested && parent ? (
                    <p className="mb-2 flex items-start gap-1.5 text-[11px] text-zinc-500">
                      <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">
                        <span className="font-medium text-zinc-600">{parent.authorName}</span>
                        への返信
                        <span className="mt-0.5 block truncate text-zinc-400">
                          {parent.body.slice(0, 80)}
                          {parent.body.length > 80 ? "…" : ""}
                        </span>
                      </span>
                    </p>
                  ) : null}
                  <div className="flex gap-2.5">
                    {uxReady ? (
                      <QnAVoteControl
                        score={a.score}
                        myVote={a.myVote}
                        disabled={voting || !sessionUserId || a.authorId === sessionUserId}
                        onVote={(v) => onVote(a.id, v)}
                      />
                    ) : null}
                    <div
                      className={`${AVATAR} h-8 w-8`}
                      style={{ backgroundColor: isBest ? "#047857" : avatarToneFromName(a.authorName) }}
                    >
                      {avatarInitial(a.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                        <span className="font-medium text-zinc-700">{a.authorName}</span>
                        <span>·</span>
                        <time dateTime={a.createdAtIso}>{formatTime(a.createdAtIso)}</time>
                        {isBest ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-200 bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <BadgeCheck className="h-3 w-3" aria-hidden />
                            ベストアンサー
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-700">
                        {a.body}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {canAnswer ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-900"
                            onClick={() => onReplyTo(replyToId === a.id ? null : a.id)}
                          >
                            {replyToId === a.id ? "キャンセル" : "返信"}
                          </button>
                        ) : null}
                        {isQuestionAuthor && !isBest ? (
                          <button
                            type="button"
                            className="rounded-md border border-emerald-700/50 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
                            onClick={() => onPickBest(a.id)}
                          >
                            ベストアンサーに選ぶ
                          </button>
                        ) : null}
                        {isQuestionAuthor && isBest ? (
                          <span className="text-[11px] font-semibold text-emerald-800">選んだベストアンサーです</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {sessionUserId ? (
        canAnswer ? (
          <form className={`mx-4 mb-6 ${PANEL} p-4`} onSubmit={onSubmitAnswer}>
            {replyParent ? (
              <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
                <span className="font-semibold text-zinc-800">{replyParent.authorName}</span>
                への返信
                <button
                  type="button"
                  className="ml-2 font-semibold text-zinc-500 underline-offset-2 hover:underline"
                  onClick={() => onReplyTo(null)}
                >
                  解除
                </button>
              </div>
            ) : null}
            <div className="flex gap-3">
              {avatarSlot}
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-[96px] w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2.5 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
                  placeholder={replyParent ? "返信を書く…" : "回答を投稿…"}
                  value={answerDraft}
                  onChange={(e) => onAnswerDraftChange(e.target.value)}
                  rows={3}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={!answerDraft.trim()}
                    className={`inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13px] font-semibold transition ${
                      answerDraft.trim()
                        ? "bg-zinc-900 text-white hover:bg-zinc-800"
                        : "cursor-not-allowed bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {replyParent ? "返信する" : "回答する"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <p className={`mx-4 mb-6 ${PANEL} px-4 py-4 text-sm text-zinc-500`}>
            自分の質問には返信できません。一覧から他の質問に返信してみよう。
          </p>
        )
      ) : (
        <p className={`mx-4 mb-6 ${PANEL} px-4 py-4 text-sm text-zinc-500`}>返信するにはログインしてください。</p>
      )}
    </div>
  );
}
