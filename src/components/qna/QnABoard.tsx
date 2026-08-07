"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { QnAComposer } from "@/components/qna/QnAComposer";
import { QnAQuestionList } from "@/components/qna/QnAQuestionList";
import { QnAThread } from "@/components/qna/QnAThread";
import { QNA_CATEGORY_DEFAULT, type QnaCategoryId } from "@/lib/qna/categories";
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
  const box = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9";
  return (
    <div
      className={`${AVATAR} ${box}`}
      style={avatarUrl ? undefined : { backgroundColor: avatarToneFromName(displayName || "ユーザー") }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        avatarInitial(displayName || "ユーザー")
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
    if (error) onAuthMessage(`知恵袋の読み込みに失敗: ${error}`);
    setQuestions(list);
    setLoading(false);
  }, [onAuthMessage]);

  const reloadAnswers = useCallback(
    async (questionId: string) => {
      if (!supabase) return;
      const { answers: list, error } = await loadQnaAnswers(
        supabase,
        questionId,
        session?.user.id ?? null,
      );
      if (error) onAuthMessage(`回答の取得に失敗: ${error}`);
      setAnswers(list);
    },
    [onAuthMessage, session?.user.id],
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
      onAuthMessage("質問を投稿するにはログインしてください。");
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      onAuthMessage("タイトルを入力してください。");
      return;
    }
    const { error } = await insertQnaQuestion(supabase, {
      authorId: session.user.id,
      authorName: displayName.trim() || session.user.email?.split("@")[0] || "ユーザー",
      title,
      body: newBody.trim(),
      category: newCategory,
    });
    if (error) {
      onAuthMessage(`質問の投稿に失敗: ${error}`);
      return;
    }
    setNewTitle("");
    setNewBody("");
    setNewCategory(QNA_CATEGORY_DEFAULT);
    onAuthMessage("質問を投稿しました。");
    onTrack?.("idea_chie_question_posted");
    onTrack?.("first_question_completed");
    await reloadBoard();
  }

  async function submitAnswer(event?: FormEvent) {
    event?.preventDefault();
    if (!supabase || !session || !detailId || !detailQuestion) return;
    if (detailQuestion.authorId === session.user.id) {
      onAuthMessage("自分の質問には回答できません。");
      return;
    }
    const body = answerDraft.trim();
    if (!body) return;
    const { error } = await insertQnaAnswer(supabase, {
      questionId: detailId,
      authorId: session.user.id,
      authorName: displayName.trim() || session.user.email?.split("@")[0] || "ユーザー",
      body,
      parentAnswerId: replyToId,
    });
    if (error) {
      onAuthMessage(`回答の投稿に失敗: ${error}`);
      return;
    }
    setAnswerDraft("");
    setReplyToId(null);
    onAuthMessage("回答を投稿しました。");
    onTrack?.("idea_chie_answer_posted");
    await reloadAnswers(detailId);
    await reloadBoard();
  }

  async function pickBest(answerId: string) {
    if (!supabase || !session || !detailId || !detailQuestion) return;
    if (detailQuestion.authorId !== session.user.id) {
      onAuthMessage("ベストアンサーは質問した本人だけが選べます。");
      return;
    }
    const { error } = await setQnaBestAnswer(supabase, detailId, session.user.id, answerId);
    if (error) {
      onAuthMessage(`ベストアンサーの設定に失敗: ${error}`);
      return;
    }
    onAuthMessage("ベストアンサーにしました。");
    onTrack?.("idea_chie_best_picked");
    await reloadBoard();
    await reloadAnswers(detailId);
  }

  async function vote(answerId: string, value: 1 | -1) {
    if (!supabase || !session) {
      onAuthMessage("投票にはログインが必要です。");
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
        <p>この質問は一覧にありません。DBの反映待ちか、削除された可能性があります。</p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
          onClick={() => {
            setDetailId(null);
            void reloadBoard();
          }}
        >
          一覧へ戻る
        </button>
      </div>
    );
  }

  if (detailId && detailQuestion) {
    return (
      <QnAThread
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
          カテゴリ・投票・ネスト返信を使うには Supabase で{" "}
          <code className="rounded bg-zinc-200/80 px-1 font-mono text-[10px]">apply_idea_chie_ux.sql</code>{" "}
          を実行してください。ベストアンサーなど既存機能はそのまま使えます。
        </div>
      ) : null}

      {session ? (
        <QnAComposer
          title={newTitle}
          body={newBody}
          category={newCategory}
          titleRef={titleRef}
          avatarSlot={<ViewerAvatar displayName={displayName} avatarUrl={avatarUrl} />}
          onTitleChange={setNewTitle}
          onBodyChange={setNewBody}
          onCategoryChange={setNewCategory}
          onSubmit={(e) => void submitQuestion(e)}
        />
      ) : (
        <div className="mx-4 mt-4 shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center">
          <p className="text-sm text-zinc-600">質問するにはログインが必要です。</p>
          <Link
            href="/login"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-zinc-900 px-4 text-[13px] font-semibold text-white no-underline hover:bg-zinc-800"
          >
            ログインして質問する
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
