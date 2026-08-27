import { NextResponse } from "next/server";
import { anthropicTextMessage } from "@/lib/ai/claudeMessages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  userId?: string;
  posts?: number;
  completedTasks?: number;
  milestones?: string[];
  streak?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const userId = body.userId?.trim();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const posts = body.posts ?? 0;
    const tasks = body.completedTasks ?? 0;
    const milestones = body.milestones ?? [];
    const streak = body.streak ?? 0;

    const ai = await anthropicTextMessage({
      system: `週次レポートをJSONで返す。キー: summary(30字以内), good(よかったこと1つ), challenge(今週チャレンジ1つ・具体的), cheer(応援40字以内)。説明文禁止。`,
      user: `先週: 投稿${posts}件, タスク完了${tasks}件, マイルストーン: ${milestones.join(", ") || "なし"}, 連続${streak}日`,
      maxTokens: 400,
    });

    const fallback = {
      summary: posts + tasks > 0 ? "ちゃんと動けた週" : "立ち上げの週",
      good: posts > 0 ? "投稿で進捗を残せた" : "ログインして向き合った",
      challenge: "未完了タスクを1つだけ今日中に片づける",
      cheer: "小さくて大丈夫。続けるのが強い。",
      week_start: new Date().toISOString().slice(0, 10),
      generated_at: new Date().toISOString(),
    };

    let report = fallback;
    if (ai.ok) {
      try {
        const parsed = JSON.parse(ai.text) as typeof fallback;
        report = { ...fallback, ...parsed, generated_at: new Date().toISOString() };
      } catch {
        /* keep fallback */
      }
    }

    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from("profiles").update({ weekly_report_json: report }).eq("id", userId);
    }

    return NextResponse.json({ ...report, offline: !ai.ok });
  } catch {
    return NextResponse.json({ error: "weekly-report error" }, { status: 500 });
  }
}
