import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

type PitchType = "investor" | "contest" | "teacher";

type Body = {
  type?: PitchType;
  projectName?: string;
  description?: string;
  milestones?: string[];
  audience?: string;
};

const TYPE_HINT: Record<PitchType, string> = {
  investor: "投資家向け。市場規模・収益性・スケールを簡潔に。",
  contest: "ビジコン向け。社会課題・革新性・チームを強調。",
  teacher: "先生・保護者向け。学習効果・安全・プロセスを強調。",
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const type = body.type ?? "contest";
    const name = (body.projectName ?? "").trim().slice(0, 120);
    const desc = (body.description ?? "").trim().slice(0, 800);
    const ms = (body.milestones ?? []).slice(0, 8).join("、");
    const audience = (body.audience ?? "").trim().slice(0, 200);

    const ai = await anthropicTextMessage({
      system: `ピッチ文を日本語で作成。${TYPE_HINT[type]} 見出し3つ+本文。合計600字以内。`,
      user: `プロジェクト: ${name}\n概要: ${desc}\n実績: ${ms || "なし"}\nターゲット: ${audience || "なし"}`,
      maxTokens: 900,
    });

    if (!ai.ok) {
      return NextResponse.json({
        pitch: `【${name || "プロジェクト"}】\n${desc || "（概要を設定するとAIが肉付けします）"}`,
        offline: true,
      });
    }

    return NextResponse.json({ pitch: ai.text, type });
  } catch {
    return NextResponse.json({ error: "pitch generate error" }, { status: 500 });
  }
}
