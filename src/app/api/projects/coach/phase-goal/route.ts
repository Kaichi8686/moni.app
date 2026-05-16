import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

type Body = {
  phaseTitle?: string;
  projectName?: string;
  projectDescription?: string;
  dreamStatement?: string;
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

    const system = `あなたは学生向けプロジェクトコーチです。出力は厳密にJSONのみ（説明文禁止）。
キー "goal" に文字列1つ。フェーズの「一言ゴール」（20〜55文字程度・日本語）。
達成がわかる具体的な言い方。励ますだけの抽象文は禁止。`;

    const user = `プロジェクト: ${name || "（なし）"}
概要: ${desc || "（なし）"}
達成したいこと: ${dream || "（なし）"}
フェーズ名: ${phaseTitle}

このフェーズでチームがそろえるべき一文ゴールをJSONで。`;

    const ai = await anthropicTextMessage({ system, user, maxTokens: 220 });

    if (!ai.ok) {
      if (ai.code === "no_key") {
        const fallback = `「${phaseTitle}」で、次の一歩がはっきりした状態にする`;
        return NextResponse.json({ goal: fallback.slice(0, 120), offline: true }, { status: 200 });
      }
      return NextResponse.json({ error: ai.message }, { status: 502 });
    }

    let goal = "";
    try {
      const parsed = JSON.parse(ai.text) as { goal?: unknown };
      goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
    } catch {
      const match = ai.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { goal?: unknown };
        goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
      }
    }

    if (!goal || goal.length > 300) {
      return NextResponse.json(
        { goal: `「${phaseTitle}」のゴールを、チームで一言で決めて書き留める`, offline: true },
        { status: 200 },
      );
    }

    return NextResponse.json({ goal, source: "anthropic" });
  } catch {
    return NextResponse.json({ error: "phase-goal API error" }, { status: 500 });
  }
}
