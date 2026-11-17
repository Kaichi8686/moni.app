import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import {
  OFFICE_DEFAULT_ANTHROPIC_MODEL,
  OFFICE_INCIDENT_SYSTEM_PROMPT,
  OFFICE_SCORING_SYSTEM_PROMPT,
  OFFICE_STRATEGY_REROLL_SYSTEM_PROMPT,
} from "@/lib/office/constants";
import { parseJsonObject } from "@/lib/office/jsonParse";
import {
  offlineIncident,
  offlineScores,
  offlineStrategies,
  type OfflineIncidentCtx,
} from "@/lib/office/offline";
import { clampScore, scoreTotal, storyToneFromTotal } from "@/lib/office/scoring";
import { parseStrategies, parseTargets } from "@/lib/office/strategy";
import { filterValidTargetsOrNull } from "@/lib/office/targetValidate";
import type {
  IncidentStrategy,
  IncidentTargetInternal,
  IncidentType,
  OfficeScores,
  StrategyKind,
  StoryTone,
} from "@/lib/office/types";

function officeModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || OFFICE_DEFAULT_ANTHROPIC_MODEL;
}

const INCIDENT_TYPES: IncidentType[] = ["pinch", "chance", "people", "rival"];
const STORY_TONES: StoryTone[] = ["great", "ok", "bitter"];

export type IncidentGenContext = OfflineIncidentCtx;

export type GeneratedIncident = {
  title: string;
  description: string;
  type: IncidentType;
  strategies: IncidentStrategy[];
  targets: IncidentTargetInternal[];
};

function normalizeIncidentFields(
  parsed: {
    title?: unknown;
    description?: unknown;
    type?: unknown;
    strategies?: unknown;
    targets?: unknown;
  },
  companyName: string,
  companyAbout: string,
): GeneratedIncident | null {
  const title = String(parsed.title ?? "").trim().slice(0, 30);
  let description = String(parsed.description ?? "").trim().slice(0, 80);
  const typeRaw = String(parsed.type ?? "").trim() as IncidentType;
  const type = INCIDENT_TYPES.includes(typeRaw) ? typeRaw : "pinch";
  if (!title || !description) return null;
  if (!description.includes(companyName)) {
    description = (`『${companyName}』で` + description).slice(0, 80);
  }
  const strategies = parseStrategies(parsed.strategies) ?? offlineStrategies();
  const parsedTargets = parseTargets(parsed.targets);
  const targets = filterValidTargetsOrNull(parsedTargets, companyAbout);
  if (!targets) return null;
  return { title, description, type, strategies, targets };
}

export async function generateIncidentWithClaude(
  ctx: IncidentGenContext,
): Promise<{ ok: true } & GeneratedIncident | { ok: false; message: string; offline?: boolean }> {
  const recent =
    ctx.recentTitles.length > 0
      ? ctx.recentTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "（なし）";
  const industry = ctx.industryLabel ? `\n業種ラベル: ${ctx.industryLabel}` : "";

  const user = `会社名: ${ctx.companyName}${industry}
会社の説明: ${ctx.companyAbout}
直近の事件タイトル（似せないで）:
${recent}

上の会社に合った事件と、作戦3枚・ターゲット4個をJSONだけで出力してください。`;

  const run = async () => {
    const ai = await anthropicTextMessage({
      system: OFFICE_INCIDENT_SYSTEM_PROMPT,
      user,
      maxTokens: 700,
      model: officeModel(),
      temperature: 0.95,
    });
    if (!ai.ok) {
      if (ai.code === "no_key") return { offline: true as const, message: ai.message };
      return { message: ai.message };
    }
    const parsed = parseJsonObject<{
      title?: unknown;
      description?: unknown;
      type?: unknown;
      strategies?: unknown;
      targets?: unknown;
    }>(ai.text);
    if (!parsed) return { message: "JSONパース失敗" };
    const normalized = normalizeIncidentFields(parsed, ctx.companyName, ctx.companyAbout);
    if (!normalized) return { message: "事件フィールド不足" };
    return normalized;
  };

  // ターゲット検証失敗時も含め、最大2回リトライ（計3試行）→だめならオフライン
  let lastMessage = "事件の生成に失敗しました";
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await run();
    if ("title" in result) return { ok: true, ...result };
    if ("offline" in result && result.offline) return { ok: true, ...offlineIncident(ctx) };
    lastMessage = result.message || lastMessage;
  }
  return { ok: true, ...offlineIncident(ctx) };
}

export async function regenerateStrategiesWithClaude(input: {
  companyName: string;
  companyAbout: string;
  title: string;
  description: string;
  previousTitles: string[];
}): Promise<
  | { ok: true; strategies: IncidentStrategy[] }
  | { ok: false; message: string; offline?: boolean }
> {
  const prev =
    input.previousTitles.length > 0
      ? input.previousTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "（なし）";
  const user = `会社名: ${input.companyName}
会社の説明: ${input.companyAbout}
事件タイトル: ${input.title}
事件の説明: ${input.description}
直前の作戦タイトル（似せないで）:
${prev}

作戦カード3枚だけJSONで出力してください。`;

  const run = async () => {
    const ai = await anthropicTextMessage({
      system: OFFICE_STRATEGY_REROLL_SYSTEM_PROMPT,
      user,
      maxTokens: 400,
      model: officeModel(),
      temperature: 0.95,
    });
    if (!ai.ok) {
      if (ai.code === "no_key") return { offline: true as const, message: ai.message };
      return { message: ai.message };
    }
    const parsed = parseJsonObject<{ strategies?: unknown }>(ai.text);
    if (!parsed) return { message: "JSONパース失敗" };
    const strategies = parseStrategies(parsed.strategies);
    if (!strategies) return { message: "作戦フィールド不足" };
    return { strategies };
  };

  const first = await run();
  if ("strategies" in first && Array.isArray(first.strategies)) {
    return { ok: true, strategies: first.strategies };
  }
  if ("offline" in first && first.offline) {
    return { ok: true, strategies: offlineStrategies() };
  }
  const second = await run();
  if ("strategies" in second && Array.isArray(second.strategies)) {
    return { ok: true, strategies: second.strategies };
  }
  if ("offline" in second && second.offline) {
    return { ok: true, strategies: offlineStrategies() };
  }
  return { ok: false, message: first.message || "作戦の引き直しに失敗しました" };
}

export async function scoreAnswerWithClaude(input: {
  companyName: string;
  industryLabel?: string;
  title: string;
  description: string;
  answer: string;
  strategyId: string;
  strategyKind: StrategyKind;
  strategyTitle: string;
  strategySummary: string;
  targetLabels: string[];
}): Promise<{ ok: true; scores: OfficeScores } | { ok: false; message: string; offline?: boolean }> {
  const strategyLine =
    input.strategyId === "custom"
      ? "作戦: 自分の作戦（custom）"
      : `作戦: [${input.strategyKind}] ${input.strategyTitle} — ${input.strategySummary}`;
  const targetsLine = `ターゲット: ${input.targetLabels.join(" / ")}`;
  const industry = input.industryLabel ? `\n業種: ${input.industryLabel}` : "";

  const user = `会社名: ${input.companyName}${industry}
事件タイトル: ${input.title}
事件の説明: ${input.description}
${strategyLine}
${targetsLine}
<answer>${input.answer}</answer>`;

  const run = async () => {
    const ai = await anthropicTextMessage({
      system: OFFICE_SCORING_SYSTEM_PROMPT,
      user,
      maxTokens: 450,
      model: officeModel(),
      temperature: 0.45,
    });
    if (!ai.ok) {
      if (ai.code === "no_key") return { offline: true as const, message: ai.message };
      return { message: ai.message };
    }
    const parsed = parseJsonObject<{
      solve?: unknown;
      fun?: unknown;
      feasible?: unknown;
      fit?: unknown;
      story?: unknown;
      story_tone?: unknown;
      next_hint?: unknown;
      comment?: unknown;
    }>(ai.text);
    if (!parsed) return { message: "JSONパース失敗" };
    const solve = clampScore(Number(parsed.solve));
    const fun = clampScore(Number(parsed.fun));
    const feasible = clampScore(Number(parsed.feasible));
    const fit = clampScore(Number(parsed.fit));
    const total = scoreTotal(solve, fun, feasible, fit);
    const toneRaw = String(parsed.story_tone ?? "").trim() as StoryTone;
    const storyTone = STORY_TONES.includes(toneRaw) ? toneRaw : storyToneFromTotal(total);
    const story =
      String(parsed.story ?? "").trim().slice(0, 180) ||
      "きみのアイデアを試してみた。結果はまずまずで、次につながる手応えがあった。";
    const nextHint =
      String(parsed.next_hint ?? "").trim().slice(0, 40) || "次はもっと具体的な一手を書いてみよう";
    const comment =
      String(parsed.comment ?? "").trim().slice(0, 60) || "いい感じのアイデアだね！";
    return {
      scores: {
        solve,
        fun,
        feasible,
        fit,
        total,
        comment,
        story,
        storyTone,
        nextHint,
      } satisfies OfficeScores,
    };
  };

  const first = await run();
  if ("scores" in first && first.scores) return { ok: true, scores: first.scores };
  if ("offline" in first && first.offline) {
    return {
      ok: true,
      scores: offlineScores(input.answer, {
        strategyKind: input.strategyKind,
        strategyTitle: input.strategyTitle,
      }),
    };
  }
  const second = await run();
  if ("scores" in second && second.scores) return { ok: true, scores: second.scores };
  if ("offline" in second && second.offline) {
    return {
      ok: true,
      scores: offlineScores(input.answer, {
        strategyKind: input.strategyKind,
        strategyTitle: input.strategyTitle,
      }),
    };
  }
  return { ok: false, message: first.message || "採点に失敗しました" };
}
