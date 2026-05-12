import type { ProjectRow } from "@/lib/projects/types";

export const ROADMAP_TEMPLATES: Record<NonNullable<ProjectRow["business_type"]>, string[]> = {
  maker: ["課題発見", "アイデア整理", "試作品づくり", "テスト", "改良", "発表 / 販売 / 展示"],
  software: ["課題設定", "要件整理", "画面設計", "開発", "テスト", "公開 / 発表"],
  social: ["社会課題の整理", "対象者理解", "活動計画", "実施", "振り返り", "継続 / 拡張"],
};

export function roadmapTemplateKey(businessType: ProjectRow["business_type"]): keyof typeof ROADMAP_TEMPLATES {
  if (businessType === "maker" || businessType === "software" || businessType === "social") return businessType;
  return "software";
}

export function businessTypeLabelJa(bt: ProjectRow["business_type"]): string {
  if (bt === "maker") return "モノづくりタイプ";
  if (bt === "software") return "ソフトウェアタイプ";
  if (bt === "social") return "社会奉仕タイプ";
  return "タイプ未設定";
}

/** 一覧・作成UI用：DBの business_type と対応する「系統」のわかりやすい表示 */
export const PROJECT_LINE_META: Record<
  NonNullable<ProjectRow["business_type"]>,
  { shortLabel: string; description: string; emoji: string }
> = {
  software: {
    shortLabel: "アプリ・デジタル系",
    description: "アプリ、Web、ゲーム、プログラミングなど",
    emoji: "💻",
  },
  maker: {
    shortLabel: "ものづくり・実験系",
    description: "工作、試作品、実験、ハード・展示など",
    emoji: "🔧",
  },
  social: {
    shortLabel: "社会・地域・奉仕系",
    description: "ボランティア、地域課題、学校外の社会活動など",
    emoji: "🌱",
  },
};

export function projectLineShortLabel(bt: ProjectRow["business_type"]): string {
  if (bt === "maker" || bt === "software" || bt === "social") return PROJECT_LINE_META[bt].shortLabel;
  return "系統未設定";
}

/** Supabase insert 用 rows（status はすべて todo、position は 1 始まり） */
export function buildRoadmapTemplateRows(projectId: string, businessType: ProjectRow["business_type"]) {
  const key = roadmapTemplateKey(businessType);
  return ROADMAP_TEMPLATES[key].map((title, idx) => ({
    project_id: projectId,
    title,
    status: "todo" as const,
    position: idx + 1,
    description: "",
    notes: "",
  }));
}
