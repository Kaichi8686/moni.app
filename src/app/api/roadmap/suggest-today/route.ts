import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import { pickLocalTodaySuggestion } from "@/lib/roadmap/todaySuggestions";

type PhasePayload = {
  title?: string;
  goal?: string;
  status?: string;
  tasks?: Array<{ title?: string; status?: string }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phases?: PhasePayload[];
      projectName?: string;
      exclude?: string;
      refreshKey?: number;
    };
    const phases = body.phases ?? [];
    const exclude = (body.exclude ?? "").trim();
    const active =
      phases.find((p) => p.status === "in_progress") ?? phases.find((p) => p.status === "planned") ?? phases[0];

    const pending =
      active?.tasks
        ?.filter((t) => t.status !== "done" && t.status !== "cancelled")
        .map((t) => (t.title ?? "").trim())
        .filter(Boolean)
        .slice(0, 5) ?? [];

    const ctx = {
      phaseTitle: active?.title,
      phaseGoal: active?.goal,
      pendingTasks: pending,
      projectName: body.projectName,
    };

    const now = new Date();
    const dayLabel = now.toLocaleDateString("ja-JP", { weekday: "long", month: "numeric", day: "numeric" });

    const user = `
あなたは高校生・大学生のビジネスチームのメンターです。
今日は ${dayLabel} です（リフレッシュ番号: ${body.refreshKey ?? now.getTime()}）。

プロジェクト: ${body.projectName?.trim() || "（名前なし）"}
現在のフェーズ: 「${active?.title ?? "未設定"}」
フェーズのゴール: 「${active?.goal ?? "未設定"}」
未完了の課題: ${pending.length ? pending.join("、") : "なし"}
${exclude ? `前回と違う提案にしてください。前回は「${exclude.slice(0, 40)}」でした。` : ""}

今日30分でできる具体的なアクションを1つだけ、22文字以内の日本語で提案してください。
理由・説明・引用符は不要。行動の短文だけを1行で返してください。
`.trim();

    const ai = await anthropicTextMessage({ user, maxTokens: 120, temperature: 0.85 });

    if (!ai.ok) {
      const suggestion = pickLocalTodaySuggestion(ctx, exclude);
      return NextResponse.json({ suggestion, offline: true, source: "local" });
    }

    const suggestion = ai.text.replace(/^["「『]|["」』]$/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    const final =
      suggestion && suggestion !== exclude
        ? suggestion
        : pickLocalTodaySuggestion(ctx, exclude || suggestion);

    return NextResponse.json({ suggestion: final, source: "ai" });
  } catch {
    return NextResponse.json({ error: "suggest-today failed" }, { status: 500 });
  }
}
