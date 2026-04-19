import { NextResponse } from "next/server";

const blockedWords = ["自傷", "暴力", "死にたい", "いじめ"];
const ideaKeywords = ["アイデア", "仮説", "検証", "課題", "ソリューション", "ピッチ", "MVP", "実験", "ニーズ"];

function containsBlockedWord(text: string) {
  return blockedWords.some((word) => text.includes(word));
}

function shouldUseIdeaMode(messages: MentorApiMessage[]) {
  const joined = messages
    .slice(-8)
    .map((m) => m.content.toLowerCase())
    .join("\n");
  return ideaKeywords.some((kw) => joined.includes(kw.toLowerCase()));
}

function latestUserText(messages: MentorApiMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return last?.content?.trim() ?? "";
}

export type MentorApiMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: MentorApiMessage[] };
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages = raw
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);

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

    const history = messages.slice(-24);
    const totalChars = history.reduce((acc, m) => acc + m.content.length, 0);
    if (totalChars > 6000) {
      return NextResponse.json({ error: "入力が長すぎます。要点を短くして送ってください。" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        reply:
          "いまはAIメンターを休止中です。予算ができたら OpenAI の API キーを .env.local の OPENAI_API_KEY に入れて、開発サーバーを再起動するとまた会話できます。それまでは他の機能を楽しんでください。",
        source: "paused",
      });
    }

    const systemBase = `あなたは子ども・若者とLINEやDMで話しているような、人間らしい日本語で返す相手です。

【話し方】
- です・ます調で、堅すぎず軽すぎない。ロボットっぽい言い回し（「〜について回答します」「以下の点に留意」など）は使わない。
- 相手の言葉や気持ちにまず短く触れてから、本題へ。毎回同じ挨拶で始めない。
- 長さは相手に合わせる。短文なら返しもコンパクトでよい。長く打ってきたらちゃんと拾う。
- 箇条書きは、手順やコツを頼まれたときだけ。普段は普通の文章で。
- 絵文字は使わなくてよい。使うならたまに1つまで。

【内容】
- 雑談・愚痴・質問・たわいもない話は、そのトーンのまま自然に応じる。必ずアイデアや起業に結びつけない。
- 起業・勉強・アプリ・目標の相談のときだけ、軽くヒントや次の一歩を足してよい。説教や長講義はしない。

【安全】
- 危険・違法・深刻な心身の問題は丁寧に断り、大人や専門家に相談するよう促す。`;
    const useIdeaMode = shouldUseIdeaMode(history);
    const ideaModeInstruction = `

【アイデア作成モード】
- アイデア相談のときは、次の思考順で整理する:
  1) 課題定義（誰の、どんな困りごとか）
  2) 仮説（なぜその解決が効くか）
  3) 検証（最小で何を確かめるか）
  4) 次アクション（24時間以内にやる1歩）
- 断定しすぎず、検証可能な表現を使う。
- 回答は長すぎない。必要なら短い見出しや箇条書きを使って読みやすくする。
- 相談者がすでに案を持っている場合は、否定よりも改善案を示す。`;
    const ideaResponseTemplate = `

【回答フォーマット（アイデア相談時）】
- 課題定義:
- 仮説:
- 検証:
- 次アクション(24h):
- 代替案(任意):`;
    const system = `${systemBase}${useIdeaMode ? `${ideaModeInstruction}\n${ideaResponseTemplate}` : ""}`;
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    const userFocus = latestUserText(history);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history],
        max_tokens: 900,
        temperature: useIdeaMode ? 0.62 : 0.88,
        frequency_penalty: 0.25,
        presence_penalty: 0.08,
        ...(useIdeaMode
          ? {
              metadata: {
                mode: "idea",
                focus: userFocus.slice(0, 120),
              },
            }
          : {}),
      }),
    });

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const detail = json.error?.message ?? response.statusText;
      const quotaOrBilling =
        response.status === 429 ||
        /quota|billing|exceeded your current quota|insufficient_quota/i.test(String(detail));
      if (quotaOrBilling) {
        return NextResponse.json({
          reply:
            "いまはAIメンターを使えません（OpenAI の利用枠や課金の都合です）。予算が整ったらまた試してね。",
          source: "paused",
        });
      }
      return NextResponse.json(
        { error: `OpenAI API エラー: ${detail}` },
        { status: 502 },
      );
    }

    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "AIからの返答が空でした。もう一度送ってみてください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply, source: "openai" });
  } catch {
    return NextResponse.json({ error: "mentor API error" }, { status: 500 });
  }
}
