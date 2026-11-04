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

export const DEMO_IDEAS: ContestIdea[] = [
  {
    id: "demo-idea-1",
    contestId: DEMO_CONTEST.id,
    userId: "demo-user-1",
    title: "机の外にスマホ置き場をつくる",
    content:
      "勉強机の上にスマホを置かないルールより、**引き出しの外（別部屋の充電器）**に固定置き場を作った方が続いた。\n\n1. 玄関かリビングに充電ステーション\n2. ポモドーロ開始前にそこに置く\n3. 休憩のときだけ取りに行く",
    appeal: "意志力より動線設計が効く",
    roadmapId: null,
    imageUrl: null,
    externalUrl: null,
    likeCount: 18,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    likedByMe: false,
    author: { id: "demo-user-1", displayName: "あおい", avatarUrl: null },
    roadmap: null,
  },
  {
    id: "demo-idea-2",
    contestId: DEMO_CONTEST.id,
    userId: "demo-user-2",
    title: "ロック画面に「今やること」を出す",
    content:
      "アプリ制限より、ロック画面ウィジェットに今日の課題を1行だけ出す。手に取った瞬間に目的が戻る。Figmaでモックも作った。",
    appeal: "触る前にリマインド",
    roadmapId: "demo-rm-2",
    imageUrl: null,
    externalUrl: "https://www.figma.com/",
    likeCount: 11,
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    likedByMe: false,
    author: { id: "demo-user-2", displayName: "けんと", avatarUrl: null },
    roadmap: {
      id: "demo-rm-2",
      userId: "demo-user-2",
      title: "ロック画面リマインド実験",
      steps: [
        { title: "ウィジェット文面を決める" },
        { title: "3日間だけ計測" },
        { title: "触った回数をメモ" },
      ],
      sourceProjectId: null,
      createdAt: new Date().toISOString(),
    },
  },
];

export function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || m.includes("does not exist") || m.includes("schema cache");
}
