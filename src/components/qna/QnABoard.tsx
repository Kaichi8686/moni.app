"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { QnAComposer } from "@/components/qna/QnAComposer";
import { QnAQuestionList } from "@/components/qna/QnAQuestionList";
import { QnAThread } from "@/components/qna/QnAThread";
import { QNA_CATEGORY_DEFAULT, type QnaCategoryId } from "@/lib/qna/categories";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  insertQnaAnswer,
  insertQnaQuestion,
  loadQnaAnswers,
  loadQnaQuestions,
  setQnaBestAnswer,
  toggleQnaAnswerVote,
} from "@/lib/qna/qnaData";
import type { QnaAnswer, QnaListFilter, QnaQuestion } from "@/lib/qna/types";
import { supabase } from "@/lib/supabase";
import { avatarInitial, avatarToneFromName } from "@/lib/ui/avatarTone";

const AVATAR =
  "flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-[12px] font-bold text-white";

type Props = {
  session: Session | null;
  displayName: string;
  avatarUrl?: string | null;
  /** When set, fills the composer title once. */
  prefillTitle?: string;
  onPrefillConsumed?: () => void;
  /** Increment to focus the composer title. */
  focusToken?: number;
  onAuthMessage: (msg: string) => void;
  formatTime: (iso: string) => string;
  /** When true, reload board. */
  active: boolean;
  onTrack?: (name: string) => void;
};

function ViewerAvatar({
  displayName,
  avatarUrl,
  size = "md",
}: {
  displayName: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const { tx } = useI18n();
  const fallback = tx("ユーザー", "User");
  const box = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9";
  return (
    <div
      className={`${AVATAR} ${box}`}
      style={avatarUrl ? undefined : { backgroundColor: avatarToneFromName(displayName || fallback) }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        avatarInitial(displayName || fallback)
      )}
    </div>
  );
}

export function QnABoard({
  session,
  displayName,
  avatarUrl,
  prefillTitle,
  onPrefillConsumed,
  focusToken = 0,
  onAuthMessage,
  formatTime,
  active,
  onTrack,
}: Props) {
  const { tx } = useI18n();
  const titleRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<QnaQuestion[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QnaAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [uxReady, setUxReady] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<QnaCategoryId>(QNA_CATEGORY_DEFAULT);
  const [answerDraft, setAnswerDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [filter, setFilter] = useState<QnaListFilter>({ category: "all", unresolvedOnly: false });

  const detailQuestion = useMemo(
    () => (detailId ? questions.find((x) => x.id === detailId) ?? null : null),
    [detailId, questions],
  );

  const reloadBoard = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { questions: list, error, uxReady: ready } = await loadQnaQuestions(supabase);
    setUxReady(ready);
    if (error) onAuthMessage(tx(`知恵袋の読み込みに失敗: ${error}`, `Failed to load Q&A: ${error}`));
    setQuestions(list);
    setLoading(false);
  }, [onAuthMessage, tx]);

  const reloadAnswers = useCallback(
    async (questionId: string) => {
      if (!supabase) return;
      const { answers: list, error } = await loadQnaAnswers(
        supabase,
        questionId,
        session?.user.id ?? null,
      );
      if (error) onAuthMessage(tx(`回答の取得に失敗: ${error}`, `Failed to load answers: ${error}`));
      setAnswers(list);
    },
    [onAuthMessage, session?.user.id, tx],
  );

  useEffect(() => {
    if (!active || !supabase) return;
    void reloadBoard();
  }, [active, reloadBoard]);

  useEffect(() => {
    if (!detailId) {
      setAnswers([]);
      setReplyToId(null);
      return;
    }
    void reloadAnswers(detailId);
  }, [detailId, reloadAnswers]);

  useEffect(() => {
    if (prefillTitle) {
      setNewTitle(prefillTitle);
      onPrefillConsumed?.();
      window.setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [prefillTitle, onPrefillConsumed]);

  useEffect(() => {
    if (focusToken > 0) titleRef.current?.focus();
  }, [focusToken]);

  async function submitQuestion(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !session) {
      onAuthMessage(tx("質問を投稿するにはログインしてください。", "Sign in to post a question."));
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      onAuthMessage(tx("タイトルを入力してください。", "Please enter a title."));
      return;
    }
    const { error } = await insertQnaQuestion(supabase, {
      authorId: session.user.id,
      authorName: displayName.trim() || session.user.email?.split("@")[0] || tx("ユーザー", "User"),
      title,
      body: newBody.trim(),
      category: newCategory,
    });
    if (error) {
      onAuthMessage(tx(`質問の投稿に失敗: ${error}`, `Failed to post question: ${error}`));
      return;
    }
    setNewTitle("");
    setNewBody("");
    setNewCategory(QNA_CATEGORY_DEFAULT);
    onAuthMessage(tx("質問を投稿しました。", "Question posted."));
    onTrack?.("idea_chie_question_posted");
    onTrack?.("first_question_completed");
    await reloadBoard();
  }

  async function submitAnswer(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !session || !detailId || !detailQuestion) return;
    if (detailQuestion.authorId === session.user.id) {
      onAuthMessage(tx("自分の質問には回答できません。", "You can’t answer your own question."));
      return;
    }
    const body = answerDraft.trim();
    if (!body) return;
    const { error } = await insertQnaAnswer(supabase, {
      questionId: detailId,
      authorId: session.user.id,
      authorName: displayName.trim() || session.user.email?.split("@")[0] || tx("ユーザー", "User"),
      body,
      parentAnswerId: replyToId,
    });
    if (error) {
      onAuthMessage(tx(`回答の投稿に失敗: ${error}`, `Failed to post answer: ${error}`));
      return;
    }
    setAnswerDraft("");
    setReplyToId(null);
    onAuthMessage(tx("回答を投稿しました。", "Answer posted."));
    onTrack?.("idea_chie_answer_posted");
    await reloadAnswers(detailId);
    await reloadBoard();
  }

  async function pickBest(answerId: string) {
    if (!supabase || !session || !detailId || !detailQuestion) return;
    if (detailQuestion.authorId !== session.user.id) {
      onAuthMessage(tx("ベストアンサーは質問した本人だけが選べます。", "Only the question author can pick a best answer."));
      return;
    }
    const { error } = await setQnaBestAnswer(supabase, detailId, session.user.id, answerId);
    if (error) {
      onAuthMessage(tx(`ベストアンサーの設定に失敗: ${error}`, `Failed to set best answer: ${error}`));
      return;
    }
    onAuthMessage(tx("ベストアンサーにしました。", "Marked as best answer."));
    onTrack?.("idea_chie_best_picked");
    await reloadBoard();
    await reloadAnswers(detailId);
  }

  async function vote(answerId: string, value: 1 | -1) {
    if (!supabase || !session) {
      onAuthMessage(tx("投票にはログインが必要です。", "Sign in to vote."));
      return;
    }
    const target = answers.find((a) => a.id === answerId);
    if (!target || target.authorId === session.user.id) return;
    setVoting(true);
    const prev = target.myVote;
    const { next, error } = await toggleQnaAnswerVote(
      supabase,
      answerId,
      session.user.id,
      value,
      prev,
    );
    if (error) {
      onAuthMessage(error);
      setVoting(false);
      return;
    }
    setAnswers((list) =>
      list.map((a) => {
        if (a.id !== answerId) return a;
        const delta = next - prev;
        return { ...a, myVote: next, score: a.score + delta };
      }),
    );
    setVoting(false);
  }

  if (detailId && !detailQuestion) {
    return (
      <div className="m-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <p>{tx("この質問は一覧にありません。DBの反映待ちか、削除された可能性があります。", "This question isn’t in the list. It may still be syncing, or it was deleted.")}</p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          onClick={() => {
            setDetailId(null);
            void reloadBoard();
          }}
        >
          {tx("一覧へ戻る", "Back to list")}
        </button>
      </div>
    );
  }

  if (detailId && detailQuestion) {
    return (
      <QnAThread
        key={detailQuestion.id}
        question={detailQuestion}
        answers={answers}
        sessionUserId={session?.user.id ?? null}
        answerDraft={answerDraft}
        replyToId={replyToId}
        voting={voting}
        uxReady={uxReady}
        avatarSlot={<ViewerAvatar displayName={displayName} avatarUrl={avatarUrl} size="sm" />}
        formatTime={formatTime}
        onBack={() => {
          setDetailId(null);
          setAnswerDraft("");
          setReplyToId(null);
        }}
        onAnswerDraftChange={setAnswerDraft}
        onReplyTo={setReplyToId}
        onSubmitAnswer={(e) => void submitAnswer(e)}
        onPickBest={(id) => void pickBest(id)}
        onVote={(id, v) => void vote(id, v)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!uxReady && session ? (
        <div className="mx-4 mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-600">
          {tx(
            "カテゴリ・投票・ネスト返信を使うには Supabase で",
            "To use categories, votes, and nested replies, run",
          )}{" "}
          <code className="rounded bg-zinc-200/80 px-1 font-mono text-[10px]">apply_idea_chie_ux.sql</code>{" "}
          {tx(
            "を実行してください。ベストアンサーなど既存機能はそのまま使えます。",
            "in Supabase. Existing features like best answer still work.",
          )}
        </div>
      ) : null}

      {session ? (
        <QnAComposer
          title={newTitle}
          body={newBody}
          category={newCategory}
          titleRef={titleRef}
          onTitleChange={setNewTitle}
          onBodyChange={setNewBody}
          onCategoryChange={setNewCategory}
          onSubmit={(e) => void submitQuestion(e)}
        />
      ) : (
        <div className="mx-4 mt-4 shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center">
          <p className="text-sm text-zinc-600">{tx("質問するにはログインが必要です。", "Sign in to ask a question.")}</p>
          <Link
            href="/login"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-zinc-900 px-4 text-[13px] font-semibold text-white no-underline hover:bg-zinc-800"
          >
            {tx("ログインして質問する", "Sign in to ask")}
          </Link>
        </div>
      )}

      <QnAQuestionList
        questions={questions}
        loading={loading}
        filter={filter}
        formatTime={formatTime}
        onFilterChange={setFilter}
        onOpen={(id) => {
          setDetailId(id);
          setAnswerDraft("");
          setReplyToId(null);
        }}
      />
    </div>
  );
}
