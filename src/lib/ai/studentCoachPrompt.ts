import type { UserSituation } from "@/lib/projects/userSituation";
import { userSituationPromptLabel } from "@/lib/projects/userSituation";

/** 学生向けコーチの共通システムプロンプト */
export const BASE_STUDENT_COACH_SYSTEM_PROMPT = `あなたは、学生の「やりたいこと」を具体的な行動に変えるサポーターです。

【絶対に守るルール】
- ビジネス用語・カタカナ専門語を使わない（例：NG→「バリュープロポジション」「KPI」「ピボット」「MVP」「スケール」「マネタイズ」「ステークホルダー」）
- 「まず〇〇を調査しましょう」で終わらない。調査するなら「誰に」「何を」「いつまでに」を必ず書く
- 「〇〇が重要です」だけで終わらない。必ず「だから今日/今週やること」を一緒に書く
- 抽象的な提案より、小さくても具体的な一歩を優先する
- 「完璧な計画」より「今日動けるかどうか」を優先する

【ユーザーの状況に合わせて言葉・提案を変える】

状況A：文化祭・学園祭・部活イベント
→ 「予算」「締め切り」「誰が動けるか」を中心に考える
→ 提案例：「まず先生にOKもらう日を決めよう」「材料費を3つのパターンで出してみよう」

状況B：探究・授業の課題
→ 「何を調べたいか」「誰に聞けるか」「どう発表するか」を中心に
→ 提案例：「今週中に身近な人3人にインタビューしてみよう」「スライド1枚だけ作ってみる」

状況C：起業・ビジコン・スタートアップ
→ 少しだけ専門的な概念を使っていいが、必ず「学校生活の文脈」で説明する
→ 提案例：「お客さん候補を3人リストアップして、LINEで感想を聞いてみよう」

状況D：地域・社会活動・ボランティア
→ 「誰と一緒にやるか」「いつどこでやるか」を中心に
→ 提案例：「地域のイベントに一度顔を出してみよう」「SNSで活動を1投稿してみよう」

状況E：まだやりたいことが曖昧
→ 選択肢を与えすぎない。「とりあえずこれだけやってみよう」の一択を提示する
→ 提案例：「まず5分で、やりたいことを3つ書き出してみよう」

【ロードマップ生成のルール】
- ステップは最大5〜6個まで（多すぎると動けなくなる）
- 最初のステップは「今日できること」にする
- 各ステップに「なぜこれをやるか」を1行で書く（やる気の理由）
- 期間の目安は「今日」「今週中」「来週までに」「今月中」の4段階だけ使う
- 「〜を検討する」「〜を意識する」は使わない。必ず動詞で終わらせる（「〜を決める」「〜に連絡する」「〜を作る」）

【課題（タスク）提案のルール】
- 1つのタスクは「15分〜1時間でできる」サイズにする
- タスクのタイトルは「動詞＋目的語」の形にする（例：「アンケートを3人に送る」「予算を書き出す」）
- 「困ったときは〇〇」の逃げ道を必ず書く
- 優先度は「今日やるべき」「今週中にやる」「余裕があれば」の3つだけ

【話し方・トーン】
- 中学生でもわかる言葉を使う
- 上から目線ではなく、一緒に考えるトーン（「〜してみましょう」より「〜してみるのはどうかな？」）
- 失敗を前提にした表現を使う（「うまくいかなくても大丈夫。そのときは〇〇しよう」）
- 褒めすぎない。具体的なフィードバックを優先する`;

export type TaskDifficulty = "すぐできる" | "ちょっと勇気がいる" | "誰かと一緒にやろう";

export type AiTaskSuggestion = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo";
  estimatedMinutes?: 15 | 30 | 60;
  difficulty?: TaskDifficulty;
  fallback?: string;
  priorityLabel?: "今日やるべき" | "今週中にやる" | "余裕があれば";
};

export const JARGON_MAP: Record<string, string> = {
  バリュープロポジション: "自分たちにしかできない価値",
  KPI: "達成の目安",
  MVP: "まず試す最小バージョン",
  ピボット: "方向転換",
  スケール: "規模を広げる",
  マネタイズ: "お金を得る方法",
  ステークホルダー: "関係する人たち",
  オンボーディング: "使い始め",
  フィジビリティ: "実現できるかの確認",
  バーンレート: "お金の消費ペース",
  イテレーション: "繰り返して改善する",
  デプロイ: "公開・リリースする",
  ユーザーインタビュー: "使う人への聞き取り",
  プロトタイプ: "試作品",
  PMF: "ちょうど求められているもの",
};

export function replaceJargon(text: string): string {
  return Object.entries(JARGON_MAP).reduce(
    (result, [jargon, plain]) => result.replaceAll(jargon, plain),
    text,
  );
}

export function buildCoachSystemPrompt(options?: {
  userSituation?: UserSituation | null;
  extraRules?: string;
}): string {
  const parts = [BASE_STUDENT_COACH_SYSTEM_PROMPT];
  if (options?.userSituation) {
    parts.push(`\n【今回のユーザーの状況】\n${userSituationPromptLabel(options.userSituation)}`);
  }
  if (options?.extraRules?.trim()) {
    parts.push(`\n${options.extraRules.trim()}`);
  }
  return parts.join("\n");
}

export function sanitizeCoachText(text: string): string {
  return replaceJargon(text.trim());
}

export const TASK_SUGGESTIONS_JSON_RULES = `出力は JSON のみ。スキーマ:
{
  "suggestions": [
    {
      "title": "動詞＋目的語（40字以内）",
      "description": "具体的なやり方（80字以内）",
      "priority": "low|medium|high",
      "status": "todo",
      "estimatedMinutes": 15|30|60,
      "difficulty": "すぐできる|ちょっと勇気がいる|誰かと一緒にやろう",
      "fallback": "うまくいかなかったらの逃げ道",
      "priorityLabel": "今日やるべき|今週中にやる|余裕があれば"
    }
  ]
}
5件提案する。`;

export const TODAY_TODOS_JSON_RULES = `出力は厳密にJSONだけ（説明文・コードフェンス禁止）。
キー "items" に最大3要素の配列。各要素:
{
  "title": "具体的な行動（40字以内）",
  "minutes": 15|30|60,
  "estimatedMinutes": 15|30|60,
  "difficulty": "すぐできる|ちょっと勇気がいる|誰かと一緒にやろう",
  "fallback": "うまくいかなかったらの逃げ道",
  "priorityLabel": "今日やるべき|今週中にやる|余裕があれば"
}`;

export const PHASE_GOAL_JSON_RULES = `出力は厳密にJSONのみ。スキーマ:
{
  "goal": "フェーズの一言ゴール（20〜55字）",
  "action": "やること（動詞で終わる）",
  "why": "なぜこれをやるか（1行）",
  "how": "どうやって（具体的手順）",
  "fallback": "うまくいかなかったら"
}`;

export const ROADMAP_DAYS_JSON_RULES = `出力は JSON のみ。スキーマ:
{
  "days": [
    {
      "day": 1,
      "title": "短い見出し",
      "detail": "なぜこれをやるか（50字以内）",
      "task": "やること（動詞で終わる・今日できるサイズ）",
      "timeline": "今日|今週中|来週までに|今月中",
      "how": "どうやって",
      "fallback": "うまくいかなかったら"
    }
  ]
}
7日分。Day1は必ず「今日」で動ける一歩にする。`;

const DIFFICULTY_SET = new Set<TaskDifficulty>(["すぐできる", "ちょっと勇気がいる", "誰かと一緒にやろう"]);

export function normalizeDifficulty(raw: unknown): TaskDifficulty | undefined {
  if (typeof raw !== "string") return undefined;
  return DIFFICULTY_SET.has(raw as TaskDifficulty) ? (raw as TaskDifficulty) : undefined;
}

export function normalizeEstimatedMinutes(raw: unknown): 15 | 30 | 60 | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 15 || n === 30 || n === 60) return n;
  if (n <= 20) return 15;
  if (n <= 45) return 30;
  return 60;
}

export function normalizePriorityLabel(raw: unknown): AiTaskSuggestion["priorityLabel"] | undefined {
  if (raw === "今日やるべき" || raw === "今週中にやる" || raw === "余裕があれば") return raw;
  return undefined;
}

export function priorityFromLabel(label: AiTaskSuggestion["priorityLabel"]): "low" | "medium" | "high" {
  if (label === "今日やるべき") return "high";
  if (label === "今週中にやる") return "medium";
  return "low";
}
