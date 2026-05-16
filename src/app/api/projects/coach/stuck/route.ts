import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

const blockedWords = ["自傷", "暴力", "死にたい", "いじめ", "自殺"];

function containsBlockedWord(text: string) {
  return blockedWords.some((word) => text.includes(word));
}

export type StuckApiMessage = { role: "user" | "assistant"; content: string };

type Body = {
  messages?: StuckApiMessage[];
  presetLabel?: string | null;
  projectName?: string;
  focusPhaseTitle?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages = raw
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 8000) }))
      .filter((m) => m.content.length > 0)
      .slice(-16);

    if (messages.length === 0) {
      return NextResponse.json({ error: "メッセージを入力してください。" }, { status: 400 });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "ユーザーのメッセージが必要です。" }, { status: 400 });
    }

    if (containsBlockedWord(lastUser.content)) {
      return NextResponse.json(
        { error: "安全のため、その内容には回答できません。別の言い方で相談してください。" },
        { status: 400 },
      );
    }

    const name = (body.projectName ?? "").trim().slice(0, 120);
    const phase = (body.focusPhaseTitle ?? "").trim().slice(0, 120);
    const preset = (body.presetLabel ?? "").trim().slice(0, 80);

    const system = `あなたは大学生チームの実行コーチです。日本語・ですます調。ロボットっぽい言い回し禁止。
- まず共感を一文、次に「今日できる一小さな一手」を2つまで提案。長文禁止（全体600文字以内）。
- 断定せず検証可能な言い方。説教しない。
- 絵文字は使わない。
プロジェクト文脈: ${name ? `「${name}」` : "（不明）"} / いまのフェーズ: ${phase || "（不明）"}
${preset ? `ユーザーが選んだ悩みカテゴリ: ${preset}` : ""}`;

    const transcript = messages.map((m) => `${m.role === "user" ? "ユーザー" : "コーチ"}: ${m.content}`).join("\n\n");

    const ai = await anthropicTextMessage({
      system,
      user: `会話:\n${transcript}\n\n---\n最後のユーザー発言に返答してください。`,
      maxTokens: 700,
    });

    if (!ai.ok) {
      if (ai.code === "no_key") {
        return NextResponse.json({
          reply:
            "AI相談はいまオフです（ANTHROPIC_API_KEY を設定すると使えます）。とりあえず「今日やることを1つだけ15分で終わるサイズに切る」を試してみてください。",
          offline: true,
        });
      }
      return NextResponse.json({ error: ai.message }, { status: 502 });
    }

    return NextResponse.json({ reply: ai.text, source: "anthropic" });
  } catch {
    return NextResponse.json({ error: "stuck API error" }, { status: 500 });
  }
}
