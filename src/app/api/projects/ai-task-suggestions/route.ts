import { NextResponse } from "next/server";

type InputBody = {
  projectName: string;
  projectDescription: string;
  recentChat?: string[];
};

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        suggestions: [
          {
            title: "1時間でやる課題仮説インタビュー準備",
            description: "想定ユーザー3人に聞く質問を5つ作る。",
            priority: "high",
            status: "todo",
          },
          {
            title: "今週の検証タスクを3つに絞る",
            description: "効果が測れるものだけ残し、担当者を仮決めする。",
            priority: "medium",
            status: "todo",
          },
        ],
        offline: true,
      },
      { status: 200 },
    );
  }

  try {
    const body = (await req.json()) as InputBody;
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const prompt = `あなたは学生プロジェクトの実行コーチです。抽象論は禁止。必ず具体タスクだけを提案してください。
JSON配列のみ返すこと。各要素は {title, description, priority, status}。
priority は low|medium|high、status は todo 固定。
5件提案する。

プロジェクト名: ${body.projectName}
説明: ${body.projectDescription}
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { suggestions?: unknown[] } | unknown[];
    const suggestions = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { suggestions?: unknown[] }).suggestions)
        ? (parsed as { suggestions: unknown[] }).suggestions
        : [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { error: "AI提案の生成に失敗しました。", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
