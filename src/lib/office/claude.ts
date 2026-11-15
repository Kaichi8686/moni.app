import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import {
  OFFICE_DEFAULT_ANTHROPIC_MODEL,
  OFFICE_INCIDENT_SYSTEM_PROMPT,
  OFFICE_SCORING_SYSTEM_PROMPT,
} from "@/lib/office/constants";
import { parseJsonObject } from "@/lib/office/jsonParse";
import { offlineIncident, offlineScores, type OfflineIncidentCtx } from "@/lib/office/offline";
import { clampScore, scoreTotal } from "@/lib/office/scoring";
import type { IncidentType, OfficeScores } from "@/lib/office/types";

function officeModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || OFFICE_DEFAULT_ANTHROPIC_MODEL;
}

type IncidentJson = { title?: unknown; description?: unknown; type?: unknown };

const INCIDENT_TYPES: IncidentType[] = ["pinch", "chance", "people", "rival"];

export type IncidentGenContext = OfflineIncidentCtx;

export async function generateIncidentWithClaude(
  ctx: IncidentGenContext,
): Promise<
  | { ok: true; title: string; description: string; type: IncidentType }
  | { ok: false; message: string; offline?: boolean }
> {
  const recent =
    ctx.recentTitles.length > 0
      ? ctx.recentTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "（なし）";

  const user = `会社名: ${ctx.companyName}
業種: ${ctx.industryLabel}
直近の事件タイトル（似せないで）:
${recent}

事件を1件、JSONだけで出力してください。`;

  const run = async () => {
    const ai = await anthropicTextMessage({
      system: OFFICE_INCIDENT_SYSTEM_PROMPT,
      user,
      maxTokens: 300,
      model: officeModel(),
      temperature: 0.95,
    });
    if (!ai.ok) {
      if (ai.code === "no_key") return { offline: true as const, message: ai.message };
      return { message: ai.message };
    }
    const parsed = parseJsonObject<IncidentJson>(ai.text);
    if (!parsed) return { message: "JSONパース失敗" };
    const title = String(parsed.title ?? "").trim().slice(0, 30);
    let description = String(parsed.description ?? "").trim().slice(0, 80);
    const typeRaw = String(parsed.type ?? "").trim() as IncidentType;
    const type = INCIDENT_TYPES.includes(typeRaw) ? typeRaw : "pinch";
    if (!title || !description) return { message: "事件フィールド不足" };
    // 会社名が無い場合は先頭に補完（80字以内に収める）
    if (!description.includes(ctx.companyName)) {
      const prefix = `『${ctx.companyName}』で`;
      description = (prefix + description).slice(0, 80);
    }
    return { title, description, type };
  };

  const first = await run();
  if ("title" in first && typeof first.title === "string") {
    return { ok: true, title: first.title, description: first.description!, type: first.type! };
  }
  if ("offline" in first && first.offline) {
    return { ok: true, ...offlineIncident(ctx) };
  }
  const second = await run();
  if ("title" in second && typeof second.title === "string") {
    return { ok: true, title: second.title, description: second.description!, type: second.type! };
  }
  if ("offline" in second && second.offline) {
    return { ok: true, ...offlineIncident(ctx) };
  }
  return { ok: false, message: first.message || "事件の生成に失敗しました" };
}

export async function scoreAnswerWithClaude(input: {
  title: string;
  description: string;
  answer: string;
}): Promise<{ ok: true; scores: OfficeScores } | { ok: false; message: string; offline?: boolean }> {
  const user = `事件タイトル: ${input.title}
事件の説明: ${input.description}
<answer>${input.answer}</answer>`;

  const run = async () => {
    const ai = await anthropicTextMessage({
      system: OFFICE_SCORING_SYSTEM_PROMPT,
      user,
      maxTokens: 250,
      model: officeModel(),
      temperature: 0.4,
    });
    if (!ai.ok) {
      if (ai.code === "no_key") return { offline: true as const, message: ai.message };
      return { message: ai.message };
    }
    const parsed = parseJsonObject<{
      solve?: unknown;
      fun?: unknown;
      feasible?: unknown;
      comment?: unknown;
    }>(ai.text);
    if (!parsed) return { message: "JSONパース失敗" };
    const solve = clampScore(Number(parsed.solve));
    const fun = clampScore(Number(parsed.fun));
    const feasible = clampScore(Number(parsed.feasible));
    const comment = String(parsed.comment ?? "").trim().slice(0, 60) || "いい感じのアイデアだね！";
    return {
      scores: {
        solve,
        fun,
        feasible,
        total: scoreTotal(solve, fun, feasible),
        comment,
      } satisfies OfficeScores,
    };
  };

  const first = await run();
  if ("scores" in first && first.scores) return { ok: true, scores: first.scores };
  if ("offline" in first && first.offline) {
    return { ok: true, scores: offlineScores(input.answer) };
  }
  const second = await run();
  if ("scores" in second && second.scores) return { ok: true, scores: second.scores };
  if ("offline" in second && second.offline) {
    return { ok: true, scores: offlineScores(input.answer) };
  }
  return { ok: false, message: first.message || "採点に失敗しました" };
}
