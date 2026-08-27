import { getBuiltinDefinitionByTemplateId } from "@/lib/projects/builtinRoadmapTemplates";
import type { ProjectTemplateDefinition } from "@/lib/projects/templateTypes";
import type { PhaseColor, RoadmapBusinessType } from "@/lib/roadmap/types";

export type PhaseTemplateItem = {
  title: string;
  goal: string;
  durationDays: number;
};

export const PHASE_TEMPLATES: Record<RoadmapBusinessType, PhaseTemplateItem[]> = {
  food: [
    { title: "コンセプト設計", goal: "ターゲットと提供価値を言葉にする", durationDays: 14 },
    { title: "試作・レシピ開発", goal: "3回以上試作して味を固める", durationDays: 21 },
    { title: "コスト計算", goal: "原価率30%以下のメニューを決める", durationDays: 7 },
    { title: "テスト販売", goal: "マルシェ等で10件以上販売する", durationDays: 14 },
    { title: "SNS集客", goal: "フォロワー100人・予約10件獲得", durationDays: 21 },
    { title: "ローンチ", goal: "本格営業を開始する", durationDays: 30 },
  ],
  retail: [
    { title: "リサーチ", goal: "競合5社を調べてポジションを決める", durationDays: 10 },
    { title: "商品選定・仕入れ", goal: "サンプル3種を仕入れてコストを確認", durationDays: 14 },
    { title: "EC出店準備", goal: "BASE or Shopifyでページを公開する", durationDays: 14 },
    { title: "テスト販売", goal: "初回10件の注文を獲得する", durationDays: 21 },
    { title: "改善・スケール", goal: "リピート率20%を目指す", durationDays: 30 },
  ],
  event: [
    { title: "コンセプト決め", goal: "開催目的とターゲットを1枚にまとめる", durationDays: 7 },
    { title: "会場・予算確保", goal: "会場を仮予約し収支計画を立てる", durationDays: 14 },
    { title: "集客・告知", goal: "SNSとチラシで50名以上に告知する", durationDays: 21 },
    { title: "当日運営準備", goal: "タイムラインと役割分担を決める", durationDays: 14 },
    { title: "当日・振り返り", goal: "アンケートで満足度を計測する", durationDays: 3 },
  ],
  education: [
    { title: "ニーズ調査", goal: "受講者候補5人にヒアリングする", durationDays: 10 },
    { title: "カリキュラム設計", goal: "1回の体験内容を決める", durationDays: 14 },
    { title: "試し講義", goal: "無料体験を1回実施する", durationDays: 14 },
    { title: "集客テスト", goal: "申込3件を獲得する", durationDays: 21 },
    { title: "正式募集", goal: "継続プランを公開する", durationDays: 30 },
  ],
  app: [
    { title: "ヒアリング", goal: "ターゲットと直接10人以上話す", durationDays: 14 },
    { title: "ワイヤーフレーム", goal: "Figmaで主要画面3枚を作る", durationDays: 14 },
    { title: "MVP開発", goal: "中核機能1つだけ動く状態にする", durationDays: 30 },
    { title: "ベータテスト", goal: "5人に使ってもらいフィードバックを得る", durationDays: 14 },
    { title: "ローンチ", goal: "Webまたはストアで公開する", durationDays: 7 },
  ],
  research: [
    { title: "問いの設定", goal: "探究テーマと仮説を1文で言える状態に", durationDays: 7 },
    { title: "文献調査", goal: "先行研究・事例を10本以上読む", durationDays: 21 },
    { title: "フィールドワーク", goal: "ヒアリング or 実地調査を実施", durationDays: 21 },
    { title: "分析・考察", goal: "データから仮説を検証する", durationDays: 14 },
    { title: "発表準備", goal: "スライドと発表原稿を完成させる", durationDays: 7 },
  ],
  other: [
    { title: "アイデア検証", goal: "誰の何を解決するか決める", durationDays: 14 },
    { title: "計画策定", goal: "やることリストと期限を決める", durationDays: 7 },
    { title: "実行", goal: "計画通りに動く", durationDays: 30 },
    { title: "振り返り・改善", goal: "次のアクションを決める", durationDays: 7 },
  ],
};

/** ロードマップ追加モーダルのアシスト用（自分入力が本体） */
export const ASSIST_TEMPLATE_OPTIONS: { id: RoadmapBusinessType; label: string }[] = [
  { id: "food", label: "🍜 飲食・カフェ" },
  { id: "retail", label: "👗 物販・EC" },
  { id: "event", label: "🎪 イベント" },
  { id: "education", label: "📖 教育・塾" },
  { id: "app", label: "📱 アプリ・IT" },
  { id: "research", label: "📚 探究・研究" },
  { id: "other", label: "📋 汎用プラン" },
];

/** @deprecated アシスト一覧は ASSIST_TEMPLATE_OPTIONS を使用 */
export const BUSINESS_TYPE_OPTIONS = ASSIST_TEMPLATE_OPTIONS.map(({ id, label }) => ({ id, label }));

const COLORS: PhaseColor[] = ["purple", "blue", "green", "amber", "red"];

export type PhaseDraftRow = {
  id: string;
  enabled: boolean;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  durationDays: number;
};

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildDraftPhasesFromDefinition(
  definition: ProjectTemplateDefinition,
  projectStart: Date,
): PhaseDraftRow[] {
  let cursor = new Date(projectStart);
  return definition.phases.map((item, idx) => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + Math.max(1, item.durationDays));
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
    return {
      id: `draft-${idx}-${item.title}`,
      enabled: true,
      title: item.title,
      goal: item.goal ?? "",
      startDate: toDateInput(start),
      endDate: toDateInput(end),
      durationDays: item.durationDays,
    };
  });
}

/** @deprecated 標準カタログは buildDraftPhasesFromBuiltinId を使用 */
export function buildDraftPhasesFromTemplate(businessType: RoadmapBusinessType, projectStart: Date): PhaseDraftRow[] {
  const items = PHASE_TEMPLATES[businessType] ?? PHASE_TEMPLATES.other;
  return buildDraftPhasesFromDefinition(
    {
      version: 1,
      phases: items.map((item) => ({ title: item.title, goal: item.goal, durationDays: item.durationDays })),
    },
    projectStart,
  );
}

export function buildDraftPhasesFromBuiltinId(builtinTemplateId: string, projectStart: Date): PhaseDraftRow[] {
  const def =
    getBuiltinDefinitionByTemplateId(`builtin:${builtinTemplateId}`) ??
    getBuiltinDefinitionByTemplateId(builtinTemplateId);
  if (!def) return [newEmptyDraftRow(projectStart)];
  return buildDraftPhasesFromDefinition(def, projectStart);
}

/** 有効な行だけ、開始日をつなげて並べ直す */
export function chainDraftPhaseDates(rows: PhaseDraftRow[], anchorStart: Date): PhaseDraftRow[] {
  let cursor = new Date(anchorStart);
  return rows.map((row) => {
    if (!row.enabled) return row;
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + Math.max(1, row.durationDays));
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
    return {
      ...row,
      startDate: toDateInput(start),
      endDate: toDateInput(end),
    };
  });
}

export function newEmptyDraftRow(start: Date): PhaseDraftRow {
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return {
    id: `draft-new-${Date.now()}`,
    enabled: true,
    title: "",
    goal: "",
    startDate: toDateInput(start),
    endDate: toDateInput(end),
    durationDays: 14,
  };
}

export function buildPhasesFromTemplate(
  projectId: string,
  businessType: RoadmapBusinessType,
  projectStart: Date,
): Array<{
  project_id: string;
  title: string;
  goal: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  color: string;
  order: number;
}> {
  const items = PHASE_TEMPLATES[businessType] ?? PHASE_TEMPLATES.other;
  let cursor = new Date(projectStart);
  return items.map((item, idx) => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + item.durationDays);
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
    return {
      project_id: projectId,
      title: item.title,
      goal: item.goal,
      description: "",
      status: idx === 0 ? "in_progress" : "planned",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      color: COLORS[idx % COLORS.length],
      order: idx,
    };
  });
}
