import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import {
  buildCoachSystemPrompt,
  normalizeDifficulty,
  normalizeEstimatedMinutes,
  normalizePriorityLabel,
  sanitizeCoachText,
  TODAY_TODOS_JSON_RULES,
} from "@/lib/ai/studentCoachPrompt";
import { parseUserSituation } from "@/lib/projects/userSituation";

type Body = {
  projectName?: string;
  projectDescription?: string;
  dreamStatement?: string;
  focusPhaseTitle?: string | null;
  focusPhaseStatus?: string | null;
  completedTaskTitles?: string[];
  openTaskTitles?: string[];
  userSituation?: string;
};

const OFFLINE_ITEMS = [
  {
    title: "今日やることを1行で書いてチャットに貼る",
    minutes: 15,
    estimatedMinutes: 15,
    difficulty: "すぐできる" as const,
    fallback: "紙に書いて写真を送ってもOK",
    priorityLabel: "今日やるべき" as const,
  },
  {
    title: "友達に現状だけ話してフィードバックを1つもらう",
    minutes: 30,
    estimatedMinutes: 30,
    difficulty: "ちょっと勇気がいる" as const,
    fallback: "LINEで送ってもOK",
    priorityLabel: "今週中にやる" as const,
  },
  {
    title: "やらないことを3つ決める",
    minutes: 15,
    estimatedMinutes: 15,
    difficulty: "すぐできる" as const,
    fallback: "1つだけ決めてもOK",
    priorityLabel: "余裕があれば" as const,
  },
];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const name = (body.projectName ?? "").trim().slice(0, 120);
    const desc = (body.projectDescription ?? "").trim().slice(0, 800);
    const dream = (body.dreamStatement ?? "").trim().slice(0, 400);
    const phase = (body.focusPhaseTitle ?? "").trim().slice(0, 120);
    const userSituation = parseUserSituation(body.userSituation);
    const doneTitles = (body.completedTaskTitles ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 15);
    const openTitles = (body.openTaskTitles ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 20);

    const system = `${buildCoachSystemPrompt({ userSituation })}

${TODAY_TODOS_JSON_RULES}`;

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
      maxTokens: 900,
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
        const title = sanitizeCoachText(typeof o.title === "string" ? o.title : "");
        const minutes = normalizeEstimatedMinutes(o.minutes ?? o.estimatedMinutes) ?? 30;
        if (!title || title.length > 200) return null;
        return {
          title,
          minutes,
          estimatedMinutes: normalizeEstimatedMinutes(o.estimatedMinutes ?? o.minutes) ?? minutes,
          difficulty: normalizeDifficulty(o.difficulty),
          fallback: sanitizeCoachText(typeof o.fallback === "string" ? o.fallback : "").slice(0, 200) || undefined,
          priorityLabel: normalizePriorityLabel(o.priorityLabel),
        };
      })
      .filter(Boolean);

    const cleaned = items.slice(0, 3);
    if (cleaned.length === 0) {
      return NextResponse.json({ items: OFFLINE_ITEMS, fallback: true }, { status: 200 });
    }

    return NextResponse.json({ items: cleaned, source: "anthropic" });
  } catch {
    return NextResponse.json({ error: "today-todos API error" }, { status: 500 });
  }
}
