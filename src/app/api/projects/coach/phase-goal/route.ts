import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import { formatRoadmapStepNotes } from "@/lib/ai/roadmapStepDisplay";
import {
  buildCoachSystemPrompt,
  PHASE_GOAL_JSON_RULES,
  sanitizeCoachText,
} from "@/lib/ai/studentCoachPrompt";
import { parseUserSituation } from "@/lib/projects/userSituation";

type Body = {
  phaseTitle?: string;
  projectName?: string;
  projectDescription?: string;
  dreamStatement?: string;
  userSituation?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const phaseTitle = (body.phaseTitle ?? "").trim().slice(0, 160);
    if (!phaseTitle) {
      return NextResponse.json({ error: "フェーズ名が必要です。" }, { status: 400 });
    }

    const name = (body.projectName ?? "").trim().slice(0, 120);
    const desc = (body.projectDescription ?? "").trim().slice(0, 600);
    const dream = (body.dreamStatement ?? "").trim().slice(0, 400);
    const userSituation = parseUserSituation(body.userSituation);

    const system = `${buildCoachSystemPrompt({ userSituation })}

${PHASE_GOAL_JSON_RULES}`;

    const user = `プロジェクト: ${name || "（なし）"}
概要: ${desc || "（なし）"}
達成したいこと: ${dream || "（なし）"}
フェーズ名: ${phaseTitle}

このフェーズでチームがそろえるべき内容をJSONで。`;

    const ai = await anthropicTextMessage({ system, user, maxTokens: 420 });

    if (!ai.ok) {
      if (ai.code === "no_key") {
        const fallback = {
          goal: `「${phaseTitle}」で、次の一歩がはっきりした状態にする`,
          action: `${phaseTitle}の最初の一歩を15分で決める`,
          why: "小さく始めると動き出せるから",
          how: "付箋に1つだけ書いて貼る",
          fallback: "友達に相談して決めてもOK",
        };
        return NextResponse.json({ ...fallback, offline: true }, { status: 200 });
      }
      return NextResponse.json({ error: ai.message }, { status: 502 });
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(ai.text) as Record<string, unknown>;
    } catch {
      const match = ai.text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    }

    const goal = sanitizeCoachText(typeof parsed.goal === "string" ? parsed.goal : "");
    const action = sanitizeCoachText(typeof parsed.action === "string" ? parsed.action : "");
    const why = sanitizeCoachText(typeof parsed.why === "string" ? parsed.why : "");
    const how = sanitizeCoachText(typeof parsed.how === "string" ? parsed.how : "");
    const fallback = sanitizeCoachText(typeof parsed.fallback === "string" ? parsed.fallback : "");

    if (!goal || goal.length > 300) {
      return NextResponse.json(
        {
          goal: `「${phaseTitle}」のゴールを、チームで一言で決めて書き留める`,
          action: `${phaseTitle}の最初の一歩を決める`,
          why: "動き出すため",
          how: "15分で話し合う",
          fallback: "1人でメモしてもOK",
          offline: true,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      goal,
      action: action || goal,
      why,
      how,
      fallback,
      notes: formatRoadmapStepNotes(how, fallback),
      source: "anthropic",
    });
  } catch {
    return NextResponse.json({ error: "phase-goal API error" }, { status: 500 });
  }
}
