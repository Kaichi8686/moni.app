/** 学生スタートアップ向け：業種カテゴリ別フェーズ（静的テンプレ） */

export type StudentRoadmapCategoryKey = "food" | "retail" | "app" | "event" | "education" | "custom";

export const STUDENT_ROADMAP_CATEGORIES: Array<{ key: StudentRoadmapCategoryKey; emoji: string; label: string }> = [
  { key: "food", emoji: "🍜", label: "飲食・カフェ" },
  { key: "retail", emoji: "👗", label: "物販・EC" },
  { key: "app", emoji: "📱", label: "アプリ・IT" },
  { key: "event", emoji: "🎪", label: "イベント" },
  { key: "education", emoji: "📚", label: "教育・塾" },
  { key: "custom", emoji: "✏️", label: "自分で作る" },
];

const PHASE_TITLES: Record<StudentRoadmapCategoryKey, string[]> = {
  food: [
    "アイデア検証（友達10人にアンケート）",
    "試作・レシピ開発",
    "コスト計算・価格設定",
    "小規模テスト販売（マルシェなど）",
    "SNS集客・ブランディング",
    "本格スタート",
  ],
  retail: [
    "ニーズ・競合リサーチ",
    "仕入れ・制作プラン",
    "商品ページ・梱包デザイン",
    "テスト販売・レビュー収集",
    "販路拡大（SNS・マーケット）",
    "仕組み化・リピート設計",
  ],
  app: [
    "課題・ニーズ検証",
    "ユーザーインタビュー（10人）",
    "ワイヤーフレーム",
    "MVP開発",
    "ベータテスト",
    "ローンチ",
  ],
  event: [
    "コンセプト・対象者の決定",
    "会場・日程・予算の叩き台",
    "告知設計（SNS・チラシ）",
    "運営リハーサル",
    "本番実施",
    "振り返り・次につなげる",
  ],
  education: [
    "ニーズ・カリキュラム仮説",
    "試し講義・無料体験",
    "教材・進め方の確定",
    "集客テスト",
    "正式募集",
    "継続運営",
  ],
  custom: [
    "アイデアを言語化する",
    "小さく試す",
    "フィードバックを集める",
    "改善して繰り返す",
    "形にする",
    "発表・公開する",
  ],
};

/** オンボーディング Step2 と連動（フェーズの初期 todo/doing/done） */
export type OnboardingProgressStageKey = "idea" | "research" | "prototype" | "live";

function roadmapStatusesForStage(stage: OnboardingProgressStageKey, n: number): Array<"todo" | "doing" | "done"> {
  const out: Array<"todo" | "doing" | "done"> = Array.from({ length: n }, () => "todo");
  if (n === 0) return out;
  const set = (i: number, v: "todo" | "doing" | "done") => {
    if (i >= 0 && i < n) out[i] = v;
  };
  switch (stage) {
    case "idea":
      set(0, "doing");
      break;
    case "research":
      if (n >= 2) {
        set(0, "done");
        set(1, "doing");
      } else {
        set(0, "doing");
      }
      break;
    case "prototype":
      if (n >= 3) {
        set(0, "done");
        set(1, "done");
        set(2, "doing");
      } else if (n === 2) {
        set(0, "done");
        set(1, "doing");
      } else {
        set(0, "doing");
      }
      break;
    case "live":
      if (n >= 4) {
        set(0, "done");
        set(1, "done");
        set(2, "done");
        set(3, "doing");
      } else if (n === 3) {
        set(0, "done");
        set(1, "done");
        set(2, "doing");
      } else if (n === 2) {
        set(0, "done");
        set(1, "doing");
      } else {
        set(0, "doing");
      }
      break;
    default:
      set(0, "doing");
  }
  return out;
}

export function buildStudentRoadmapTemplateRowsWithProgress(
  projectId: string,
  category: StudentRoadmapCategoryKey,
  stage: OnboardingProgressStageKey,
) {
  const titles = PHASE_TITLES[category];
  const statuses = roadmapStatusesForStage(stage, titles.length);
  return titles.map((title, idx) => ({
    project_id: projectId,
    title,
    status: statuses[idx],
    position: idx + 1,
    description: "",
    notes: "",
  }));
}

export function buildStudentRoadmapTemplateRows(projectId: string, category: StudentRoadmapCategoryKey) {
  const titles = PHASE_TITLES[category];
  return titles.map((title, idx) => ({
    project_id: projectId,
    title,
    status: "todo" as const,
    position: idx + 1,
    description: "",
    notes: "",
  }));
}
