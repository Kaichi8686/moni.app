import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isQnaCategoryId,
  QNA_CATEGORY_DEFAULT,
  type QnaCategoryId,
} from "@/lib/qna/categories";
import type { QnaAnswer, QnaQuestion } from "@/lib/qna/types";

/** DATA: UX columns/tables may be missing until apply_idea_chie_ux.sql is run. */
let uxReady: boolean | null = null;

export async function isQnaUxSchemaReady(supabase: SupabaseClient): Promise<boolean> {
  if (uxReady !== null) return uxReady;
  const { error } = await supabase.from("idea_questions").select("category,last_reply_at").limit(1);
  uxReady = !error;
  return uxReady;
}

export function resetQnaUxSchemaCache() {
  uxReady = null;
}

function mapCategory(raw: unknown): QnaCategoryId {
  const s = typeof raw === "string" ? raw : "";
  return isQnaCategoryId(s) ? s : QNA_CATEGORY_DEFAULT;
}

export async function loadQnaQuestions(supabase: SupabaseClient): Promise<{
  questions: QnaQuestion[];
  error: string | null;
  uxReady: boolean;
}> {
  const ready = await isQnaUxSchemaReady(supabase);

  const query = ready
    ? supabase
        .from("idea_questions")
        .select("id,author_id,author_display_name,title,body,best_answer_id,created_at,category,last_reply_at")
        .order("created_at", { ascending: false })
        .limit(80)
    : supabase
        .from("idea_questions")
        .select("id,author_id,author_display_name,title,body,best_answer_id,created_at")
        .order("created_at", { ascending: false })
        .limit(80);

  const { data: qrows, error: qerr } = await query;

  if (qerr) {
    if (qerr.code === "42P01" || qerr.code === "PGRST205") {
      return { questions: [], error: null, uxReady: ready };
    }
    return { questions: [], error: qerr.message, uxReady: ready };
  }

  const { data: arows, error: aerr } = await supabase.from("idea_answers").select("question_id");
  const countMap: Record<string, number> = {};
  if (!aerr && arows) {
    for (const row of arows as Array<{ question_id: string }>) {
      countMap[row.question_id] = (countMap[row.question_id] ?? 0) + 1;
    }
  }

  const questions: QnaQuestion[] = ((qrows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    authorId: r.author_id as string,
    authorName: (r.author_display_name as string) || "ユーザー",
    title: r.title as string,
    body: (r.body as string) ?? "",
    category: mapCategory(r.category),
    bestAnswerId: (r.best_answer_id as string | null) ?? null,
    createdAtIso: r.created_at as string,
    lastReplyAtIso: (r.last_reply_at as string | null) ?? null,
    answerCount: countMap[r.id as string] ?? 0,
  }));

  return { questions, error: null, uxReady: ready };
}

export async function loadQnaAnswers(
  supabase: SupabaseClient,
  questionId: string,
  viewerId: string | null,
): Promise<{ answers: QnaAnswer[]; error: string | null }> {
  const ready = await isQnaUxSchemaReady(supabase);

  const query = ready
    ? supabase
        .from("idea_answers")
        .select("id,question_id,author_id,author_display_name,body,created_at,parent_answer_id,score")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true })
    : supabase
        .from("idea_answers")
        .select("id,question_id,author_id,author_display_name,body,created_at")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error) return { answers: [], error: error.message };

  const answers: QnaAnswer[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    questionId: r.question_id as string,
    authorId: r.author_id as string,
    authorName: (r.author_display_name as string) || "ユーザー",
    body: r.body as string,
    createdAtIso: r.created_at as string,
    parentAnswerId: (r.parent_answer_id as string | null) ?? null,
    score: typeof r.score === "number" ? r.score : 0,
    myVote: 0 as const,
  }));

  if (ready && viewerId && answers.length > 0) {
    const ids = answers.map((a) => a.id);
    const { data: votes } = await supabase
      .from("idea_answer_votes")
      .select("answer_id,value")
      .eq("user_id", viewerId)
      .in("answer_id", ids);
    if (votes) {
      const map = new Map(
        (votes as Array<{ answer_id: string; value: number }>).map((v) => [v.answer_id, v.value]),
      );
      for (const a of answers) {
        const v = map.get(a.id);
        if (v === 1 || v === -1) a.myVote = v;
      }
    }
  }

  return { answers, error: null };
}

export async function insertQnaQuestion(
  supabase: SupabaseClient,
  input: {
    authorId: string;
    authorName: string;
    title: string;
    body: string;
    category: QnaCategoryId;
  },
): Promise<{ error: string | null }> {
  const ready = await isQnaUxSchemaReady(supabase);
  const payload: Record<string, unknown> = {
    author_id: input.authorId,
    author_display_name: input.authorName,
    title: input.title,
    body: input.body,
  };
  if (ready) payload.category = input.category;
  const { error } = await supabase.from("idea_questions").insert(payload);
  return { error: error?.message ?? null };
}

export async function insertQnaAnswer(
  supabase: SupabaseClient,
  input: {
    questionId: string;
    authorId: string;
    authorName: string;
    body: string;
    parentAnswerId?: string | null;
  },
): Promise<{ error: string | null }> {
  const ready = await isQnaUxSchemaReady(supabase);
  const payload: Record<string, unknown> = {
    question_id: input.questionId,
    author_id: input.authorId,
    author_display_name: input.authorName,
    body: input.body,
  };
  if (ready && input.parentAnswerId) payload.parent_answer_id = input.parentAnswerId;
  const { error } = await supabase.from("idea_answers").insert(payload);
  return { error: error?.message ?? null };
}

export async function setQnaBestAnswer(
  supabase: SupabaseClient,
  questionId: string,
  authorId: string,
  answerId: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("idea_questions")
    .update({ best_answer_id: answerId })
    .eq("id", questionId)
    .eq("author_id", authorId);
  return { error: error?.message ?? null };
}

/** Toggle vote. value must be 1 or -1. Passing the same value again clears the vote. */
export async function toggleQnaAnswerVote(
  supabase: SupabaseClient,
  answerId: string,
  userId: string,
  value: 1 | -1,
  current: 0 | 1 | -1,
): Promise<{ next: 0 | 1 | -1; error: string | null }> {
  const ready = await isQnaUxSchemaReady(supabase);
  if (!ready) return { next: current, error: "投票には apply_idea_chie_ux.sql の適用が必要です" };

  if (current === value) {
    const { error } = await supabase
      .from("idea_answer_votes")
      .delete()
      .eq("answer_id", answerId)
      .eq("user_id", userId);
    return { next: error ? current : 0, error: error?.message ?? null };
  }

  const { error } = await supabase.from("idea_answer_votes").upsert(
    { answer_id: answerId, user_id: userId, value },
    { onConflict: "answer_id,user_id" },
  );
  return { next: error ? current : value, error: error?.message ?? null };
}
