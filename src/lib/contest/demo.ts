import type { Contest, ContestIdea } from "@/lib/contest/types";

export const DEMO_CONTEST: Contest = {
  id: "demo-contest",
  title: "勉強中のスマホ誘惑を断ち切れない問題",
  description:
    "集中したいのに通知やSNSで手が伸びてしまう。テキスト・スケッチ・プロトタイプURL・ロードマップなど、自由な形で解決アイデアを発表してください。",
  whyText: "学生・社会人どちらも共感が多い「実行の最初の壁」。完璧な企画書は不要、ラフでもOKです。",
  rewardText: "上位入賞でプロフィール実績バッジ＋コミュニティフィーチャー",
  promptHint: "スマホ誘惑を減らすアイデア",
  category: "habits",
  startAt: new Date(Date.now() - 86400000).toISOString(),
  endAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  status: "active",
  createdAt: new Date().toISOString(),
};

export const DEMO_CONTEST_SECONDARY: Contest = {
  id: "demo-contest-2",
  title: "朝起きられない問題をどうにかしたい",
  description: "アラームを何度もスヌーズしてしまう朝の習慣を変えるアイデアを募集。",
  whyText: null,
  rewardText: null,
  promptHint: null,
  category: "habits",
  startAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  endAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  status: "active",
  createdAt: new Date().toISOString(),
};

/** デモの模範投稿は出さない（空ギャラリー） */
export const DEMO_IDEAS: ContestIdea[] = [];

export function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || m.includes("does not exist") || m.includes("schema cache");
}
