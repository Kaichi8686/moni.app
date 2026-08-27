import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/auth/verifyCronSecret";
import { sendWeeklyReportEmail } from "@/lib/email/weeklyReportEmail";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** 毎週月曜8時想定 — Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", hint: auth.reason }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id,display_name,weekly_report_json,notify_email_weekly")
    .eq("notify_email_weekly", true)
    .not("weekly_report_json", "is", null)
    .limit(200);

  let sent = 0;
  for (const p of profiles ?? []) {
    const report = p.weekly_report_json as {
      summary?: string;
      good?: string;
      challenge?: string;
      cheer?: string;
    };
    if (!report?.summary) continue;
    const { data: user } = await admin.auth.admin.getUserById(p.id as string);
    const email = user.user?.email;
    if (!email) continue;
    const r = await sendWeeklyReportEmail(email, (p.display_name as string) || "あなた", {
      summary: report.summary ?? "",
      good: report.good ?? "",
      challenge: report.challenge ?? "",
      cheer: report.cheer ?? "",
    });
    if (r.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, candidates: profiles?.length ?? 0 });
}
