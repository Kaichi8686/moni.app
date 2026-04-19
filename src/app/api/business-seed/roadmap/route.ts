import { NextResponse } from "next/server";
import type { RoadmapDay } from "@/lib/business-seed/types";
import { defaultRoadmapFromIdea } from "@/lib/business-seed/default-roadmap";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { finalizedIdea?: string; interests?: string };
    const finalizedIdea = typeof body.finalizedIdea === "string" ? body.finalizedIdea.trim() : "";
    const interests = typeof body.interests === "string" ? body.interests.trim() : "";

    if (!finalizedIdea) {
      return NextResponse.json({ error: "finalizedIdea が必要です。" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const days = defaultRoadmapFromIdea(finalizedIdea);
      return NextResponse.json({ days, offline: true });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

    const system = `あなたは行動計画コーチです。ユーザーのビジネスアイデアに合わせ、**7日間**のロードマップを作ってください。
各日は日本の学生が放課後に実行できるボリュームにすること。

出力は JSON のみ。スキーマ:
{
  "days": [
    {"day":1,"title":"短い見出し","detail":"50字以内で目的","task":"今日やる1つのタスク（命令形・具体）"},
    ... day 7 まで
  ]
}

Day1=課題深掘り Day2=ターゲット明確化 Day3=仮説 Day4=検証 Day5=改善 Day6=簡易アウトプット Day7=振り返り
タスクは必ず「今日終わらせる一歩」に限定。`;

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
          {
            role: "user",
            content: `関心: ${interests.slice(0, 300)}\n\nアイデア:\n${finalizedIdea.slice(0, 2000)}\n\nJSONのみで7日分返してください。`,
          },
        ],
        temperature: 0.45,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const days = defaultRoadmapFromIdea(finalizedIdea);
      return NextResponse.json({ days, fallback: true });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as { days?: RoadmapDay[] };
    const days = Array.isArray(parsed.days) ? parsed.days : [];

    if (days.length < 7) {
      return NextResponse.json({ days: defaultRoadmapFromIdea(finalizedIdea), fallback: true });
    }

    const normalized = days
      .slice(0, 7)
      .map((d, i) => ({
        day: typeof d.day === "number" ? d.day : i + 1,
        title: String(d.title ?? `Day ${i + 1}`).slice(0, 80),
        detail: String(d.detail ?? "").slice(0, 200),
        task: String(d.task ?? "今日やることを1つ書き出す").slice(0, 240),
      }));

    return NextResponse.json({ days: normalized });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
