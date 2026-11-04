import type { Contest, ContestEntry } from "@/lib/contest/types";

/** DB未適用時のプレビュー用シード */
export const DEMO_CONTEST: Contest = {
  id: "demo-contest",
  title: "勉強中のスマホ誘惑を断ち切れない問題",
  description:
    "集中したいのに通知やSNSで手が伸びてしまう。意志力だけに頼らない、現実的な解決ロードマップを募集します。",
  whyText: "学生・社会人どちらも共感が多い「実行の最初の壁」。小さな習慣設計で突破できるお題です。",
  rewardText: "上位入賞でプロフィール実績バッジ＋コミュニティフィーチャー",
  promptHint: "勉強中のスマホ誘惑を減らすための、1〜2週間で実行できるステップ型ロードマップ",
  category: "habits",
  startAt: new Date(Date.now() - 86400000).toISOString(),
  endAt: new Date(Date.now() + 14 * 86400000).toISOString(),
  status: "active",
  createdAt: new Date().toISOString(),
};

export const DEMO_ENTRIES: ContestEntry[] = [
  {
    id: "demo-entry-1",
    contestId: DEMO_CONTEST.id,
    userId: "demo-user-1",
    roadmapId: "demo-rm-1",
    comment: "通知オフより先に、机のレイアウトを変えるのが効きました。",
    likeCount: 12,
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    likedByMe: false,
    author: { id: "demo-user-1", displayName: "あおい", avatarUrl: null },
    roadmap: {
      id: "demo-rm-1",
      userId: "demo-user-1",
      title: "机からスマホを消す2週間プラン",
      steps: [
        { title: "勉強机の引き出しにスマホ置き場を作る", detail: "視界から外す" },
        { title: "ポモドーロ開始時だけロックアプリをON", detail: "25分固定" },
        { title: "夜に「誘惑ログ」を3行だけ書く", detail: "パターン把握" },
        { title: "週末にルールを1つだけ調整", detail: "継続しやすさ優先" },
      ],
      sourceProjectId: null,
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "demo-entry-2",
    contestId: DEMO_CONTEST.id,
    userId: "demo-user-2",
    roadmapId: "demo-rm-2",
    comment: "友達と進捗を共有すると、こっそり見る回数が減りました。",
    likeCount: 7,
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    likedByMe: false,
    author: { id: "demo-user-2", displayName: "けんと", avatarUrl: null },
    roadmap: {
      id: "demo-rm-2",
      userId: "demo-user-2",
      title: "アカウンタビリティで集中を守る",
      steps: [
        { title: "勉強バディを1人決める" },
        { title: "毎日22時にスクショ報告" },
        { title: "週1でルール振り返り通話15分" },
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
