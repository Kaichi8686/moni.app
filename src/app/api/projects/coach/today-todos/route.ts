import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";

type Body = {
  projectName?: string;
  projectDescription?: string;
  dreamStatement?: string;
  focusPhaseTitle?: string | null;
  focusPhaseStatus?: string | null;
  completedTaskTitles?: string[];
  openTaskTitles?: string[];
};

const OFFLINE_ITEMS = [
  { title: "今日やることを1行で書いてチャットに貼る（2分）", minutes: 2 },
  { title: "先輩・友達に現状だけ話してフィードバックを1つもらう（15分）", minutes: 15 },
  { title: "やらないことを3つ決める（10分）", minutes: 10 },
];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = (body.projectName ?? "").trim().slice(0, 120);
    const desc = (body.projectDescription ?? "").trim().slice(0, 800);
    const dream = (body.dreamStatement ?? "").trim().slice(0, 400);
    const phase = (body.focusPhaseTitle ?? "").trim().slice(0, 120);
    const doneTitles = (body.completedTaskTitles ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 15);
    const openTitles = (body.openTaskTitles ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 20);

    const system = `あなたは大学生のマイクロビジネスコーチです。出力は厳密にJSONだけ（説明文・コードフェンス禁止）。
キー "items" に最大3要素の配列。各要素は { "title": string（具体的な行動、40文字以内推奨）, "minutes": number（5,10,15,20,30のいずれか） }。
今日すぐできる粒度。抽象的な励ましは禁止。日本語で。`;

    const user = `プロジェクト名: ${name || "（なし）"}
概要: ${desc || "（なし）"}
達成したいこと: ${dream || "（なし）"}
いまのフェーズ: ${phase || "（なし）"}（状態: ${body.focusPhaseStatus ?? "—"}）
未完了タスク例: ${openTitles.length ? openTitles.join(" / ") : "（なし）"}
最近完了したタスク: ${doneTitles.length ? doneTitles.join(" / ") : "（なし）"}

上記だけを踏まえ、今日できるアクションを最大3件JSONで。`;

    const ai = await anthropicTextMessage({
      system,
      user,
      maxTokens: 700,
    });

    if (!ai.ok) {
      if (ai.code === "no_key") {
        return NextResponse.json({ items: OFFLINE_ITEMS, offline: true }, { status: 200 });
      }
      return NextResponse.json({ error: ai.message }, { status: 502 });
    }

    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(ai.text) as { items?: unknown };
    } catch {
      const match = ai.text.match(/\{[\s\S]*\}/);
      parsed = match ? (JSON.parse(match[0]) as { items?: unknown }) : { items: [] };
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const title = typeof o.title === "string" ? o.title.trim() : "";
        const minutesRaw = typeof o.minutes === "number" ? o.minutes : Number(o.minutes);
        const allowed = [5, 10, 15, 20, 30];
        const minutes = allowed.includes(minutesRaw) ? minutesRaw : 30;
        if (!title || title.length > 200) return null;
        return { title, minutes };
      })
      .filter(Boolean) as Array<{ title: string; minutes: number }>;

    const cleaned = items.slice(0, 3);
    if (cleaned.length === 0) {
      return NextResponse.json({ items: OFFLINE_ITEMS, fallback: true }, { status: 200 });
    }

    return NextResponse.json({ items: cleaned, source: "anthropic" });
  } catch {
    return NextResponse.json({ error: "today-todos API error" }, { status: 500 });
  }
}
