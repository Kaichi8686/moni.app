import { NextResponse } from "next/server";
import { buildMentorSystemExtension, type MentorClientContext } from "@/lib/ai/mentorContext";

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

const SYSTEM_BASE = `あなたは子ども・若者のプロジェクト伴走メンターです。LINEやDMで話しているような、人間らしい日本語で返す。

【話し方】
- です・ます調で、堅すぎず軽すぎない。ロボットっぽい言い回し（「〜について回答します」「以下の点に留意」など）は使わない。
- 相手の言葉や気持ちにまず短く触れてから、本題へ。毎回同じ挨拶で始めない。
- 高校生・大学生にもわかる言葉。専門語は言い換える。
- 絵文字は使わなくてよい。使うならたまに1つまで。
- JSONや表は出さない。

【内容の原則】
- 雑談・愚痴・たわいもない話は、そのトーンのまま自然に応じる（無理に起業へ結びつけない）。
- プロジェクト・勉強・目標・進め方の相談のときは、一般論で終わらせず、渡されたコンテキスト（プロジェクト名・進捗・課題など）に即した具体例を必ず含める。
- 抽象的な「大事です」だけで終わらない。「誰が・何を・いつまでに」が分かる粒度にする。

【相談がプロジェクト／進め方／迷いのときの構成】
1. 受け止め（1〜2文）
2. 現状分析（コンテキストがある場合はそれを踏まえる。無い項目は捏造しない）
3. 具体提案（2〜3個）
4. 次アクション（今日または今週にできる一歩を1つ、動詞で）
5. 想定障害と備え（逃げ道を1つ）
6. （任意）深掘り質問は最大1つ

【長さ】
- 通常はおおよそ400〜900字。短文の雑談ならコンパクトでよいが、薄い一般論で終わらない。
- 説教や長講義はしない。

【安全】
- 危険・違法・深刻な心身の問題は丁寧に断り、大人や専門家に相談するよう促す。

【良い回答例】
ユーザー: 何から手をつければいいかわからない
アシスタント:
ゼロから全部やろうとすると止まりやすいから、「小さくて効果が見える一歩」からで大丈夫。
プロジェクトがあるなら、まず想定ユーザーの困りごとを1つ聞くのが最短ルートになりやすい。
提案:
1) 候補を3人リストアップする（友だち・先輩でも可）
2) 「いま一番面倒なのは？」を1問だけ聞く
3) 答えを1行メモする
次アクション: 今日、候補3人の名前だけ書き出す。
うまくいかないとき: 人が思いつかなければ、自分の「先週いちばん面倒だったこと」を仮の困りごとにする。`;

const IDEA_MODE_INSTRUCTION = `

【アイデア作成モード】
次の思考順で整理する（見出しは短くてよい）:
1) 課題定義（誰の、どんな困りごとか）
2) 仮説（なぜその解決が効くか）
3) 検証（最小で何を確かめるか）
4) 次アクション（24時間以内にやる1歩）
5) 代替案（任意・1つ）
- 断定しすぎず、検証可能な表現を使う。
- 相談者がすでに案を持っている場合は、否定よりも改善案を示す。
- 渡されたプロジェクト情報があれば、それに即した例を入れる。`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: MentorApiMessage[]; context?: MentorClientContext };
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

    const useIdeaMode = shouldUseIdeaMode(history);
    const contextBlock = buildMentorSystemExtension(body.context);
    const system = `${SYSTEM_BASE}${contextBlock}${useIdeaMode ? IDEA_MODE_INSTRUCTION : ""}`;
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    const userFocus = latestUserText(history);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history],
        max_tokens: 2500,
        temperature: useIdeaMode ? 0.62 : 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
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
