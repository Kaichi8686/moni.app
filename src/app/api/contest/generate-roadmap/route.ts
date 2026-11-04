import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import type { ContestRoadmapStep } from "@/lib/contest/types";

function fallbackSteps(prompt: string): ContestRoadmapStep[] {
  const theme = prompt.trim().slice(0, 40) || "この課題";
  return [
    { title: `${theme}の現状を書き出す`, detail: "いつ・どこで・何が起きるか" },
    { title: "邪魔になるトリガーを1つ特定する", detail: "通知・場所・時間帯など" },
    { title: "環境を先に変える小さなルールを決める", detail: "意志力より仕組み優先" },
    { title: "3日間だけ実験して記録する", detail: "うまくいった条件を残す" },
    { title: "ルールを1つ調整して継続する", detail: "完璧より続きやすさ" },
  ];
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as { prompt?: string; contestTitle?: string };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const contestTitle = typeof body.contestTitle === "string" ? body.contestTitle.trim() : "";
    if (!prompt && !contestTitle) {
      return NextResponse.json({ error: "prompt が必要です。" }, { status: 400 });
    }

    const theme = prompt || contestTitle;
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        title: `${contestTitle || "課題"}への解決ロードマップ`,
        steps: fallbackSteps(theme),
        offline: true,
      });
    }

    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(40_000),
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "あなたは学生向け実行コーチです。悩み課題に対する実行可能なロードマップをJSONで返します。" +
              '形式: {"title":"短いタイトル","steps":[{"title":"ステップ名","detail":"補足"}]}。' +
              "stepsは4〜7個。抽象論ではなく今日からできる行動にしてください。",
          },
          {
            role: "user",
            content: `お題: ${contestTitle.slice(0, 120)}\n要望: ${theme.slice(0, 800)}\nJSONのみで返してください。`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        title: `${contestTitle || "課題"}への解決ロードマップ`,
        steps: fallbackSteps(theme),
        fallback: true,
      });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as { title?: string; steps?: ContestRoadmapStep[] };
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .map((s) => ({
            title: String(s?.title ?? "").trim().slice(0, 80),
            detail: s?.detail ? String(s.detail).trim().slice(0, 160) : undefined,
          }))
          .filter((s) => s.title)
          .slice(0, 8)
      : [];

    if (steps.length < 3) {
      return NextResponse.json({
        title: String(parsed.title ?? `${contestTitle || "課題"}への解決ロードマップ`).slice(0, 120),
        steps: fallbackSteps(theme),
        fallback: true,
      });
    }

    return NextResponse.json({
      title: String(parsed.title ?? `${contestTitle || "課題"}への解決ロードマップ`).slice(0, 120),
      steps,
    });
  } catch {
    return NextResponse.json({ error: "generate-roadmap failed" }, { status: 500 });
  }
}
