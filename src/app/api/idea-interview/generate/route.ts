import { NextResponse } from "next/server";
import { geminiChat } from "@/lib/ai/geminiMessages";
import {
  IDEA_INTERVIEW_GENERATE_SYSTEM,
  buildGenerateUserPayload,
} from "@/lib/idea-interview/prompts";
import { ruleBasedGenerateSeeds } from "@/lib/idea-interview/ruleEngine";
import type { IdeaInterviewMessage, IdeaInterviewTheme, IdeaSeed } from "@/lib/idea-interview/types";
import { themeLabel } from "@/lib/idea-interview/types";

export const runtime = "nodejs";

type Body = {
  theme: IdeaInterviewTheme;
  messages: IdeaInterviewMessage[];
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
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!theme) {
    return NextResponse.json({ error: "missing_theme" }, { status: 400 });
  }

  const fallback = ruleBasedGenerateSeeds({ theme, messages });

  const gemini = await geminiChat({
    system: IDEA_INTERVIEW_GENERATE_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildGenerateUserPayload({
          themeLabel: themeLabel(theme),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      },
    ],
    temperature: 0.75,
    responseSchema: {
      type: "object",
      properties: {
        seeds: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
            },
            required: ["title", "summary"],
          },
        },
      },
      required: ["seeds"],
    },
  });

  if (!gemini.ok) {
    return NextResponse.json({ mode: "demo", seeds: fallback });
  }

  const parsed = parseJsonLoose(gemini.text);
  const rawSeeds = Array.isArray(parsed?.seeds) ? parsed.seeds : [];
  const seeds: IdeaSeed[] = rawSeeds
    .map((s, i) => {
      if (!s || typeof s !== "object") return null;
      const row = s as { title?: unknown; summary?: unknown };
      const title = String(row.title ?? "").trim();
      const summary = String(row.summary ?? "").trim();
      if (!title || !summary) return null;
      return { id: `seed-${i + 1}`, title, summary };
    })
    .filter((s): s is IdeaSeed => Boolean(s))
    .slice(0, 5);

  if (seeds.length < 3) {
    return NextResponse.json({ mode: "demo", seeds: fallback });
  }

  return NextResponse.json({ mode: "gemini", seeds });
}
