"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, CornerDownRight, MessageCircle } from "lucide-react";
import { QnAVoteControl } from "@/components/qna/QnAVoteControl";
import { qnaCategoryLabel } from "@/lib/qna/categories";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { QnaAnswer, QnaQuestion } from "@/lib/qna/types";
import { avatarInitial, avatarToneFromName } from "@/lib/ui/avatarTone";

const PANEL =
  "rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";
const AVATAR =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-bold text-white";

const INITIAL_ANSWER_VISIBLE = 3;

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
  const { tx, locale } = useI18n();
  const ordered = useMemo(() => sortThread(answers, q.bestAnswerId), [answers, q.bestAnswerId]);
  const byId = useMemo(() => new Map(answers.map((a) => [a.id, a])), [answers]);
  const isQuestionAuthor = Boolean(sessionUserId && q.authorId === sessionUserId);
  const canAnswer = Boolean(sessionUserId && q.authorId !== sessionUserId);
  const replyParent = replyToId ? byId.get(replyToId) : null;
  const resolved = Boolean(q.bestAnswerId);

  const [visibleAnswerCount, setVisibleAnswerCount] = useState(INITIAL_ANSWER_VISIBLE);
  const visibleAnswers = ordered.slice(0, visibleAnswerCount);
  const hiddenAnswerCount = Math.max(0, ordered.length - visibleAnswerCount);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-white px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          className="rounded-md p-2 text-zinc-900 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          aria-label={tx("一覧に戻る", "Back to list")}
          onClick={onBack}
        >
          <span className="text-lg" aria-hidden>
            ←
          </span>
        </button>
        <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{tx("スレッド", "Thread")}</span>
      </div>

      {/* 質問ブロック */}
      <article className={`m-4 ${PANEL} overflow-hidden`}>
        <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
            {tx("質問", "Question")}
          </p>
        </div>
        <div className="p-4 sm:p-5">
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
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {resolved ? tx("解決済み", "Resolved") : tx("未解決", "Unresolved")}
                </span>
                <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {qnaCategoryLabel(q.category, locale)}
                </span>
              </div>
              <h4 className="mt-2 text-[16px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                {q.title.trim()}
              </h4>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{q.authorName}</span>
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                <time dateTime={q.createdAtIso}>{formatTime(q.createdAtIso)}</time>
              </p>
              {q.body.trim() ? (
                <p className="mt-3 whitespace-pre-wrap break-words text-[14px] font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {q.body.trim()}
                </p>
              ) : null}
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                  <span className="tabular-nums">{q.answerCount}</span>
                  <span>{tx("回答", "replies")}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* 回答ブロック（階層化） */}
      <section className="mx-4 mb-4">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">{tx("回答", "Answers")}</p>
          <span className="text-[11px] tabular-nums text-zinc-400">{ordered.length}</span>
        </div>

        <div className={`${PANEL} overflow-hidden`}>
          {ordered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              {tx("まだ回答がありません。最初のヒントを書いてみよう。", "No answers yet. Be the first to help.")}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibleAnswers.map((a) => {
                const isBest = q.bestAnswerId === a.id;
                const isNested = Boolean(a.parentAnswerId);
                const parent = a.parentAnswerId ? byId.get(a.parentAnswerId) : null;
                const highlightMine =
                  isQuestionAuthor && sessionUserId && a.authorId !== sessionUserId;

                return (
                  <li
                    key={a.id}
                    className={`py-4 pl-4 pr-4 ${isBest ? "bg-emerald-50/40 dark:bg-emerald-950/20" : highlightMine ? "bg-sky-50/30 dark:bg-sky-950/20" : ""} ${
                      isNested ? "ml-3 border-l-2 border-zinc-200 pl-4 sm:ml-5 dark:border-zinc-700" : "border-l-2 border-indigo-200 pl-4 dark:border-indigo-800"
                    }`}
                  >
                    {isNested && parent ? (
                      <p className="mb-2 flex items-start gap-1.5 text-[11px] text-zinc-500">
                        <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0">
                          {locale === "en" ? (
                            <>
                              Reply to{" "}
                              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                                {parent.authorName}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                                {parent.authorName}
                              </span>
                              への返信
                            </>
                          )}
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
                        className={`${AVATAR} ${isNested ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[10px]"}`}
                        style={{
                          backgroundColor: isBest ? "#047857" : avatarToneFromName(a.authorName),
                        }}
                      >
                        {avatarInitial(a.authorName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {a.authorName}
                          </span>
                          <span>·</span>
                          <time dateTime={a.createdAtIso}>{formatTime(a.createdAtIso)}</time>
                          {isBest ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-200 bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              <BadgeCheck className="h-3 w-3" aria-hidden />
                              {tx("ベストアンサー", "Best answer")}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {a.body}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {canAnswer ? (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                              onClick={() => onReplyTo(replyToId === a.id ? null : a.id)}
                            >
                              {replyToId === a.id ? tx("キャンセル", "Cancel") : tx("返信", "Reply")}
                            </button>
                          ) : null}
                          {isQuestionAuthor && !isBest ? (
                            <button
                              type="button"
                              className="rounded-md border border-emerald-700/50 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-zinc-900 dark:hover:bg-emerald-950/30"
                              onClick={() => onPickBest(a.id)}
                            >
                              {tx("ベストアンサーに選ぶ", "Mark as best answer")}
                            </button>
                          ) : null}
                          {isQuestionAuthor && isBest ? (
                            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                              {tx("選んだベストアンサーです", "This is your best answer")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {hiddenAnswerCount > 0 ? (
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setVisibleAnswerCount(ordered.length)}
                className="text-[12px] font-semibold text-indigo-700 transition hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200"
              >
                {tx(`残り ${hiddenAnswerCount} 件の回答を見る`, `See ${hiddenAnswerCount} more answers`)}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {sessionUserId ? (
        canAnswer ? (
          <form className={`mx-4 mb-6 ${PANEL} p-4`} onSubmit={onSubmitAnswer}>
            {replyParent ? (
              <div className="mb-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {locale === "en" ? (
                  <>
                    Reply to{" "}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                      {replyParent.authorName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                      {replyParent.authorName}
                    </span>
                    への返信
                  </>
                )}
                <button
                  type="button"
                  className="ml-2 font-semibold text-zinc-500 underline-offset-2 hover:underline"
                  onClick={() => onReplyTo(null)}
                >
                  {tx("解除", "Clear")}
                </button>
              </div>
            ) : null}
            <div className="flex gap-3">
              {avatarSlot}
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-[96px] w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2.5 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:bg-zinc-900"
                  placeholder={replyParent ? tx("返信を書く…", "Write a reply…") : tx("回答を投稿…", "Post an answer…")}
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
                        ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                        : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                    }`}
                  >
                    {replyParent ? tx("返信する", "Reply") : tx("回答する", "Answer")}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <p className={`mx-4 mb-6 ${PANEL} px-4 py-4 text-sm text-zinc-500`}>
            {tx("自分の質問には返信できません。一覧から他の質問に返信してみよう。", "You can’t reply to your own question. Try answering someone else’s.")}
          </p>
        )
      ) : (
        <p className={`mx-4 mb-6 ${PANEL} px-4 py-4 text-sm text-zinc-500`}>
          {tx("返信するにはログインしてください。", "Sign in to reply.")}
        </p>
      )}
    </div>
  );
}
