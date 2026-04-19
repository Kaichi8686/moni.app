import { NextResponse } from "next/server";
import type { BizSeedApiMessage } from "../brainstorm/route";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { interests?: string; messages?: BizSeedApiMessage[] };
    const interests = typeof body.interests === "string" ? body.interests.trim() : "";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!interests) {
      return NextResponse.json({ error: "interests が必要です。" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        finalizedIdea:
          "（AIオフ）壁打ちの内容を自分で1段落にまとめてください：誰の・どんな課題を・どう解決するか。",
        offline: true,
      });
    }

    const history = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0)
      .slice(-30);

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const system = `あなたはビジネスコーチです。会話から「1つのビジネスアイデア」を日本語で**1段落（180〜320字）**にまとめてください。
- です・ます調
- 誰の・何の課題・どんな提供価値・なぜ自分たちか、が分かること
- 賞賛や前置き禁止。本文のみ。

出力は JSON のみ: {"finalizedIdea":"..."}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          {
            role: "user",
            content: `関心タグ: ${interests.slice(0, 400)}\n\n上記の対話を1つのビジネスアイデアに要約してください。JSONのみ。`,
          },
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "OpenAI エラー" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as { finalizedIdea?: string };
    const finalizedIdea =
      typeof parsed.finalizedIdea === "string" && parsed.finalizedIdea.trim()
        ? parsed.finalizedIdea.trim()
        : "要約に失敗しました。もう一度お試しください。";

    return NextResponse.json({ finalizedIdea });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
