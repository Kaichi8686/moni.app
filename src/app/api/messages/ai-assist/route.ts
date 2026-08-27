import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

type Mode = "polish" | "translate" | "collab_request" | "suggest";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      context?: string;
      mode?: Mode;
    };
    const text = body.text?.trim() ?? "";
    const mode = body.mode ?? "polish";
    const context = body.context?.trim() ?? "";

    const prompts: Record<Mode, string> = {
      polish: `以下のメッセージをより丁寧・明確に書き直してください（一言で）: "${text}"`,
      translate: `以下を自然な英語に翻訳してください: "${text}"`,
      collab_request: `以下の内容でコラボ依頼メッセージを作成（日本語・200字以内）: ${context || text}`,
      suggest: `このチャットの流れから次のメッセージを1つ提案（日本語・短く）: ${context}`,
    };

    const ai = await anthropicTextMessage({
      user: prompts[mode],
      maxTokens: 220,
      temperature: 0.6,
    });

    if (!ai.ok) {
      if (ai.code === "no_key") {
        return NextResponse.json({
          result:
            mode === "translate" && text
              ? `[翻訳プレビュー] ${text}`
              : text || "AIキー未設定のため、そのまま送信してください。",
          offline: true,
        });
      }
      return NextResponse.json({ error: ai.message }, { status: 502 });
    }

    return NextResponse.json({ result: ai.text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "エラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
