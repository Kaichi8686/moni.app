import { NextResponse } from "next/server";
import {
  buildCoachSystemPrompt,
  normalizeDifficulty,
  normalizeEstimatedMinutes,
  normalizePriorityLabel,
  priorityFromLabel,
  sanitizeCoachText,
  TASK_SUGGESTIONS_JSON_RULES,
  type AiTaskSuggestion,
} from "@/lib/ai/studentCoachPrompt";
import { parseUserSituation } from "@/lib/projects/userSituation";

type InputBody = {
  projectName: string;
  projectDescription: string;
  recentChat?: string[];
  userSituation?: string;
  userInput?: string;
};

const OFFLINE_SUGGESTIONS: AiTaskSuggestion[] = [
  {
    title: "友達3人にアンケートを送る",
    description: "「こういうのあったら使う？」とLINEで聞く。返事が来なくても1人分はOK。",
    priority: "high",
    status: "todo",
    estimatedMinutes: 30,
    difficulty: "すぐできる",
    fallback: "口頭で聞いてメモしてもOK",
    priorityLabel: "今日やるべき",
  },
  {
    title: "今週やることを3つに絞る",
    description: "全部やろうとせず、今週中に終わるサイズだけ残す。",
    priority: "medium",
    status: "todo",
    estimatedMinutes: 15,
    difficulty: "すぐできる",
    fallback: "1つだけ決めてもOK",
    priorityLabel: "今週中にやる",
  },
];

function normalizeSuggestion(raw: unknown): AiTaskSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = sanitizeCoachText(typeof o.title === "string" ? o.title : "");
  const description = sanitizeCoachText(typeof o.description === "string" ? o.description : "");
  if (!title || title.length > 200) return null;

  const priorityLabel = normalizePriorityLabel(o.priorityLabel);
  const priorityRaw = typeof o.priority === "string" ? o.priority : "";
  let priority: "low" | "medium" | "high" = "medium";
  if (priorityRaw === "low" || priorityRaw === "medium" || priorityRaw === "high") priority = priorityRaw;
  else if (priorityLabel) priority = priorityFromLabel(priorityLabel);

  return {
    title,
    description: description.slice(0, 400),
    priority,
    status: "todo",
    estimatedMinutes: normalizeEstimatedMinutes(o.estimatedMinutes ?? o.minutes),
    difficulty: normalizeDifficulty(o.difficulty),
    fallback: sanitizeCoachText(typeof o.fallback === "string" ? o.fallback : "").slice(0, 200) || undefined,
    priorityLabel,
  };
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ suggestions: OFFLINE_SUGGESTIONS, offline: true }, { status: 200 });
  }

  try {
    const body = (await req.json()) as InputBody;
    const userSituation = parseUserSituation(body.userSituation);
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const system = buildCoachSystemPrompt({ userSituation });
    const user = `${TASK_SUGGESTIONS_JSON_RULES}

プロジェクト名: ${body.projectName}
説明: ${body.projectDescription}
${body.userInput?.trim() ? `ユーザーの入力: ${body.userInput.trim().slice(0, 800)}` : ""}
最近の会話:
${(body.recentChat ?? []).slice(0, 8).join("\n")}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { suggestions?: unknown[] } | unknown[];
    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { suggestions?: unknown[] }).suggestions)
        ? (parsed as { suggestions: unknown[] }).suggestions
        : [];

    const suggestions = rawList
      .map(normalizeSuggestion)
      .filter(Boolean)
      .slice(0, 5) as AiTaskSuggestion[];

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: OFFLINE_SUGGESTIONS, fallback: true }, { status: 200 });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: "AI提案の生成に失敗しました。", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
