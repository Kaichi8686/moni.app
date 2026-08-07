import type { QnaCategoryId } from "@/lib/qna/categories";

export type QnaQuestion = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  category: QnaCategoryId;
  bestAnswerId: string | null;
  createdAtIso: string;
  lastReplyAtIso: string | null;
  answerCount: number;
};

export type QnaAnswer = {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAtIso: string;
  parentAnswerId: string | null;
  score: number;
  /** Current viewer's vote: 1 | -1 | 0 */
  myVote: 0 | 1 | -1;
};

export type QnaListFilter = {
  category: QnaCategoryId | "all";
  unresolvedOnly: boolean;
};
