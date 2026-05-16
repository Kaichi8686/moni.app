import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

type PhasePayload = {
  title?: string;
  goal?: string;
  status?: string;
  tasks?: Array<{ title?: string; status?: string }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phases?: PhasePayload[] };
    const phases = body.phases ?? [];
    const active =
      phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "planned") ?? phases[0];

    const pending =
      active?.tasks?.filter((t) => t.status !== "done").map((t) => (t.title ?? "").trim()).filter(Boolean).slice(0, 5) ??
      [];

    const user = `
あなたはビジネスを始めた学生のメンターです。
現在のフェーズ：「${active?.title ?? "未設定"}」
フェーズのゴール：「${active?.goal ?? "未設定"}」
未完了のタスク：${pending.length ? pending.join("、") : "なし"}

今日30分でできる具体的なアクションを1つだけ、25文字以内で提案してください。
理由や説明は不要です。アクションだけ答えてください。
`.trim();

    const ai = await anthropicTextMessage({ user, maxTokens: 120 });

    if (!ai.ok) {
      const fallback = active?.goal?.slice(0, 40) ?? "今日やることを1つ、紙に書いて15分だけ取り組む";
      return NextResponse.json({ suggestion: fallback, offline: true });
    }

    const suggestion = ai.text.replace(/^["「]|["」]$/g, "").slice(0, 80);
    return NextResponse.json({ suggestion: suggestion || "チームで今日のゴールを1行で決める" });
  } catch {
    return NextResponse.json({ error: "suggest-today failed" }, { status: 500 });
  }
}
