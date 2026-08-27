import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  userId?: string;
  projectName?: string;
  phaseTitle?: string;
  openTasks?: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const userId = body.userId?.trim();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const projectName = (body.projectName ?? "").trim().slice(0, 120);
    const phase = (body.phaseTitle ?? "").trim().slice(0, 120);
    const open = (body.openTasks ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 8);

    const ai = await anthropicTextMessage({
      system: `あなたは学生ビジネスメンター。今日30分でできる具体的なアクションを1つだけ、日本語40文字以内で返す。JSONのみ: {"action":"..."}`,
      user: `プロジェクト: ${projectName || "なし"}\nフェーズ: ${phase || "なし"}\n未完了: ${open.join("、") || "なし"}`,
      maxTokens: 200,
      temperature: 0.5,
    });

    let action =
      open[0] ? `「${open[0]}」を15分だけ進める` : "今日の目標をノートに1行書く（3分）";
    if (ai.ok) {
      try {
        const parsed = JSON.parse(ai.text) as { action?: string };
        if (parsed.action?.trim()) action = parsed.action.trim().slice(0, 120);
      } catch {
        const m = ai.text.match(/"action"\s*:\s*"([^"]+)"/);
        if (m?.[1]) action = m[1].slice(0, 120);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const payload = { date: today, action, generated_at: new Date().toISOString() };

    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from("profiles").update({ today_action_json: payload }).eq("id", userId);
    }

    return NextResponse.json({ ...payload, offline: !ai.ok });
  } catch {
    return NextResponse.json({ error: "today-action error" }, { status: 500 });
  }
}
