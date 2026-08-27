import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/auth/verifyCronSecret";
import { sendPushToUser } from "@/lib/push/serverPush";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Vercel Cron: 毎朝8時 JST 想定 — Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", hint: auth.reason }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id,today_action_json,notify_push")
    .eq("notify_push", true)
    .not("today_action_json", "is", null)
    .limit(500);

  let sentTotal = 0;
  for (const p of profiles ?? []) {
    const raw = p.today_action_json as { date?: string; action?: string } | null;
    if (raw?.date !== today || !raw.action) continue;
    const r = await sendPushToUser(p.id as string, {
      title: "今日の1アクション",
      body: raw.action,
      url: "/?tab=posts",
    });
    sentTotal += r.sent;
  }

  return NextResponse.json({ ok: true, sentTotal, users: profiles?.length ?? 0 });
}
