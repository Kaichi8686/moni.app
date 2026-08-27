import { NextResponse } from "next/server";
import { sendWeeklyReportEmail } from "@/lib/email/weeklyReportEmail";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = { userId?: string; email?: string };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const userId = body.userId?.trim();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: prof } = await admin
    .from("profiles")
    .select("display_name,weekly_report_json,notify_email_weekly")
    .eq("id", userId)
    .maybeSingle();

  const report = prof?.weekly_report_json as {
    summary?: string;
    good?: string;
    challenge?: string;
    cheer?: string;
  } | null;
  if (!report?.summary) {
    return NextResponse.json({ error: "先に週次レポートを生成してください" }, { status: 400 });
  }

  const email = body.email?.trim();
  let to = email;
  if (!to) {
    const { data: user } = await admin.auth.admin.getUserById(userId);
    to = user.user?.email ?? undefined;
  }
  if (!to) return NextResponse.json({ error: "メールアドレスがありません" }, { status: 400 });

  const result = await sendWeeklyReportEmail(to, (prof?.display_name as string) || "あなた", {
    summary: report.summary ?? "",
    good: report.good ?? "",
    challenge: report.challenge ?? "",
    cheer: report.cheer ?? "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, to });
}
