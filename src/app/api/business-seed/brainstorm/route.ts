import { NextResponse } from "next/server";

export type BizSeedApiMessage = { role: "user" | "assistant"; content: string };

const blocked = ["自傷", "暴力", "死にたい", "いじめ"];

function blockedText(t: string) {
  return blocked.some((w) => t.includes(w));
}

const STEP_FOCUS: Record<number, string> = {
  1: "誰の課題か（どの年齢・どんな状況の人か）を特定すること",
  2: "どんな不便・問題か（場面・頻度・気持ちまで）を言語化すること",
  3: "既存の解決策（アプリ・サービス・学校のルールなど）は何か",
  4: "なぜそれでは不十分か（時間・お金・心理・環境など具体理由）",
  5: "自分ならどう解決するか（できる範囲で具体的な仕組み・行動）",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      interests?: string;
      stepIndex?: number;
      messages?: BizSeedApiMessage[];
      bootstrap?: boolean;
    };

    const interests = typeof body.interests === "string" ? body.interests.trim() : "";
    const stepIndex = typeof body.stepIndex === "number" ? body.stepIndex : 1;
    const bootstrap = Boolean(body.bootstrap);
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    if (stepIndex < 1 || stepIndex > 5) {
      return NextResponse.json({ error: "stepIndex は 1〜5 です。" }, { status: 400 });
    }

    if (!interests || interests.length < 2) {
      return NextResponse.json({ error: "興味・関心を短くでも入力してください。" }, { status: 400 });
    }

    const messages = rawMessages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        reply:
          "（簡易モード）AIキー未設定のため、このあとは画面のガイドとあなたの入力の長さで進めます。必要なら .env.local に OPENAI_API_KEY を追加してください。",
        advance: false,
        offline: true as const,
        stepIndex,
      });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!bootstrap && !lastUser) {
      return NextResponse.json({ error: "ユーザーの回答が必要です。" }, { status: 400 });
    }

    if (lastUser && blockedText(lastUser.content)) {
      return NextResponse.json({ error: "安全のため、この内容には進めません。別の表現で書いてください。" }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const system = `あなたは中学生〜大学生向けのビジネス思考コーチです。ユーザーを「行動」へ進めることが目的です。

【絶対禁止】
- 「いいアイデアですね」「素晴らしい」などの肯定的なお喋りだけで終わること
- 抽象的・一般論だけの回答
- ステップを飛ばすこと

【必須】
- 回答が曖昧・短すぎる（例: 10文字以下、誰か不明、場面がない）場合は advance=false で、**1つの具体化の質問だけ**を返す
- 具体化できたと判断したら advance=true。reply には (1) 一行で要約して肯定はしない、(2) 次のステップに進む指示を含める。ただし次のステップの「本文の質問」は reply に含めてよい（長くても300字以内）

現在のステップ: ${stepIndex} / 5
このステップの焦点: ${STEP_FOCUS[stepIndex] ?? ""}

出力は**必ずJSONのみ**（改行・説明文禁止）:
{"advance":trueまたはfalse,"reply":"ユーザーに見せる日本語メッセージ（です・ます調）"}

interestタグ・関心: ${interests.slice(0, 500)}
`;

    const userPayload = bootstrap
      ? `bootstrap: ユーザーの関心は上記。ステップ${stepIndex}の**最初の質問**を1つだけ返してください。話し出しは短く、今日中に答えられる具体レベルで。JSONのみ。`
      : `会話履歴に基づき、直近のユーザーの発言を評価して JSON を返してください。`;

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: system },
      ...messages.slice(-16).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userPayload },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: 0.35,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `OpenAI: ${res.status}`, detail: errText.slice(0, 200) }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    let parsed: { advance?: boolean; reply?: string };
    try {
      parsed = JSON.parse(raw) as { advance?: boolean; reply?: string };
    } catch {
      return NextResponse.json({ error: "AIの応答形式が不正です。もう一度お試しください。" }, { status: 502 });
    }

    const advance = Boolean(parsed.advance);
    const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "もう少しだけ具体的に教えてください（誰の・どんな場面か）。";

    return NextResponse.json({ advance, reply, stepIndex });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
