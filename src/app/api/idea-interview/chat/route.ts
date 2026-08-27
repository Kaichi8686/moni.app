import { NextResponse } from "next/server";
import { geminiChat } from "@/lib/ai/geminiMessages";
import {
  IDEA_INTERVIEW_CHAT_SYSTEM,
  buildChatUserPayload,
  joinInterviewAssistantMessage,
} from "@/lib/idea-interview/prompts";
import { ruleBasedChatReply } from "@/lib/idea-interview/ruleEngine";
import type { IdeaInterviewTheme } from "@/lib/idea-interview/types";
import { themeLabel } from "@/lib/idea-interview/types";

export const runtime = "nodejs";

type Body = {
  theme: IdeaInterviewTheme;
  userTurns: number;
  latestUserMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
};

function parseJsonLoose(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const theme = body.theme;
  const latest = (body.latestUserMessage ?? "").trim();
  if (!theme || !latest) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const userTurns = Math.max(1, Number(body.userTurns) || 1);
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  const fallback = ruleBasedChatReply({ theme, userTurns, latestUserMessage: latest });

  const gemini = await geminiChat({
    system: IDEA_INTERVIEW_CHAT_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildChatUserPayload({
          themeLabel: themeLabel(theme),
          userTurns,
          latestUserMessage: latest,
          history,
        }),
      },
    ],
    temperature: 0.8,
    responseSchema: {
      type: "object",
      properties: {
        ack: { type: "string" },
        question: { type: "string" },
        placeholder: { type: "string" },
        readyForIdeas: { type: "boolean" },
        closing: { type: "string" },
      },
      required: ["ack", "question", "placeholder", "readyForIdeas", "closing"],
    },
  });

  if (!gemini.ok) {
    return NextResponse.json({
      mode: "demo",
      ...fallback,
    });
  }

  const parsed = parseJsonLoose(gemini.text);
  if (!parsed) {
    return NextResponse.json({ mode: "demo", ...fallback });
  }

  const ack = String(parsed.ack ?? "").trim();
  // モデル判断を尊重。上限だけキャップ（必須回数にしない。早期終了はボタンでも可）
  const readyForIdeas = Boolean(parsed.readyForIdeas) || userTurns >= 5;
  const question = readyForIdeas ? "" : String(parsed.question ?? "").trim() || fallback.question;
  // ack が極端に短いときはフォールバックの厚い反射で補強（テンプレ一言相槌の回避）
  const richAck =
    ack.length >= 80
      ? ack
      : readyForIdeas
        ? ack || fallback.ack
        : fallback.ack.length > ack.length
          ? fallback.ack
          : ack || fallback.ack;
  const closing = readyForIdeas
    ? String(parsed.closing ?? "").trim() || fallback.closing
    : "";
  const placeholder = readyForIdeas
    ? ""
    : String(parsed.placeholder ?? "").trim() || fallback.placeholder;

  const assistantMessage = joinInterviewAssistantMessage({
    ack: richAck,
    question,
    closing,
    readyForIdeas,
  });

  return NextResponse.json({
    mode: "gemini",
    ack: richAck,
    question,
    placeholder,
    readyForIdeas,
    closing,
    assistantMessage,
  });
}
