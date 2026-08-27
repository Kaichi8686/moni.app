import type { ProjectSettingsMeta } from "@/components/projects/workspace/ProjectSettingsModal";
import type { Project } from "@/lib/workspace/types";
import { simplifyIssueText } from "@/lib/workspace/issuePlainLanguage";

export type ProjectIssueContext = {
  projectName: string;
  /** 1〜2文の要約（説明 or 理念） */
  projectSummary: string;
  /** 誰のためか */
  audience: string;
  /** アプリ / ものづくり など */
  projectKindLabel: string;
};

const BUSINESS_LABELS: Record<string, string> = {
  software: "アプリ・Webサービス",
  maker: "ものづくり・物販",
  social: "社会課題・コミュニティ",
};

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function projectIssueContextFromRow(row: {
  name: string;
  description?: string | null;
  category?: string | null;
  business_type?: string | null;
  recruitment_target?: string | null;
  recruitment_message?: string | null;
}): ProjectIssueContext {
  const projectName = row.name.trim() || "このプロジェクト";
  const desc = row.description?.trim() ?? "";
  const vision = row.recruitment_message?.trim() ?? "";
  const target = row.recruitment_target?.trim() ?? "";
  const category = row.category?.trim() ?? "";
  const kind =
    (row.business_type && BUSINESS_LABELS[row.business_type]) ||
    (category ? `${category}の取り組み` : "探究プロジェクト");

  const projectSummary = clip(vision || desc || `${projectName}を進めるための活動`, 160);
  const audience = target || "このプロジェクトの利用者・仲間";

  return { projectName, projectSummary, audience, projectKindLabel: kind };
}

export function projectIssueContextFromWorkspace(
  project: Project,
  meta: Pick<
    ProjectSettingsMeta,
    "category" | "business_type" | "recruitment_target" | "recruitment_message"
  > | null,
): ProjectIssueContext {
  return projectIssueContextFromRow({
    name: project.name,
    description: project.description,
    category: meta?.category,
    business_type: meta?.business_type,
    recruitment_target: meta?.recruitment_target,
    recruitment_message: meta?.recruitment_message,
  });
}

type PhaseBits = { title: string; goal?: string };

type TitleRule = {
  test: (title: string) => boolean;
  build: (raw: string, ctx: ProjectIssueContext, phase: PhaseBits) => string;
};

const TITLE_RULES: TitleRule[] = [
  {
    test: (t) => /ターゲット|候補.*(リスト|10)/i.test(t),
    build: (_, ctx) => `「${ctx.audience}」に話を聞く相手を10人リストアップ（${ctx.projectName}）`,
  },
  {
    test: (t) => /インタビュー|話す|ヒアリング|対話/i.test(t),
    build: (_, ctx) => `「${ctx.audience}」に${ctx.projectName}のことを5人と話を聞く`,
  },
  {
    test: (t) => /競合|似た|参考/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」の参考になる事例を5つ調べる`,
  },
  {
    test: (t) => /Lean|計画表|1枚/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」の計画を1枚にまとめる`,
  },
  {
    test: (t) => /コア機能|機能.*絞/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」のいちばん大事な機能を3つに絞る`,
  },
  {
    test: (t) => /ワイヤー|画面.*下書き|フロー/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」の画面の下書きをつくる`,
  },
  {
    test: (t) => /プロト|お試し版|MVP|最初の.*版/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」のお試し版をつくる`,
  },
  {
    test: (t) => /ユーザーテスト|使ってもらう/i.test(t),
    build: (_, ctx) => `「${ctx.audience}」に${ctx.projectName}を使ってもらい意見をもらう`,
  },
  {
    test: (t) => /技術スタック|環境構築/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」を作るための道具・環境を決める`,
  },
  {
    test: (t) => /アナリティクス|利用の記録|データ/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」が使われているか記録する仕組みを入れる`,
  },
  {
    test: (t) => /価格|課金|請求|Stripe|決済/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」のお金のルール（価格・決済）を決める`,
  },
  {
    test: (t) => /発表|スライド|ピッチ/i.test(t),
    build: (_, ctx) => `「${ctx.projectName}」の発表資料をつくる`,
  },
  {
    test: (t) => /課題.*(絞|3つ)/i.test(t),
    build: (_, ctx) => `「${ctx.audience}」の困りごとを3つに絞る（${ctx.projectName}）`,
  },
];

/** テンプレート由来の汎用タイトルを、プロジェクト内容に寄せた言い方にする */
export function personalizeIssueTitle(
  rawTitle: string,
  ctx: ProjectIssueContext,
  phase: PhaseBits,
): string {
  const base = simplifyIssueText(rawTitle);
  if (!base) return ctx.projectName;
  if (base.includes(ctx.projectName)) return base;

  for (const rule of TITLE_RULES) {
    if (rule.test(base)) return simplifyIssueText(rule.build(base, ctx, phase));
  }

  const phaseHint = phase.goal?.trim() ? simplifyIssueText(phase.goal).slice(0, 24) : "";
  if (base.length <= 18) {
    return simplifyIssueText(
      phaseHint
        ? `「${ctx.projectName}」で ${base}（${phaseHint}）`
        : `「${ctx.projectName}」のための ${base}`,
    );
  }

  return simplifyIssueText(`「${ctx.projectName}」: ${base}`);
}

export function personalizeIssueDescription(input: {
  ctx: ProjectIssueContext;
  phaseTitle: string;
  phaseGoal?: string;
  phaseGuide?: string;
  taskTitle: string;
}): string {
  const parts: string[] = [];

  parts.push(
    `【このプロジェクト】\n${input.ctx.projectName}（${input.ctx.projectKindLabel}）\n${input.ctx.projectSummary}`,
  );
  parts.push(`【想定する人】\n${input.ctx.audience}`);
  parts.push(`【いまの段階】\n${simplifyIssueText(input.phaseTitle)}`);

  if (input.phaseGoal?.trim()) {
    parts.push(`【この段階のねらい】\n${simplifyIssueText(input.phaseGoal.trim())}`);
  }

  parts.push(`【この課題でやること】\n${simplifyIssueText(input.taskTitle)}`);

  if (input.phaseGuide?.trim()) {
    const guide = simplifyIssueText(input.phaseGuide.trim());
    parts.push(guide.length > 360 ? `【ヒント】\n${guide.slice(0, 360)}…` : `【ヒント】\n${guide}`);
  }

  return parts.join("\n\n");
}
