import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  userId?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const userId = body.userId?.trim();
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth_key = body.keys?.auth?.trim();
  if (!userId || !endpoint || !p256dh || !auth_key) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server DB unavailable" }, { status: 503 });

  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: userId, endpoint, p256dh, auth_key },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { userId?: string; endpoint?: string };
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server DB unavailable" }, { status: 503 });
  let q = admin.from("push_subscriptions").delete();
  if (body.endpoint) q = q.eq("endpoint", body.endpoint);
  if (body.userId) q = q.eq("user_id", body.userId);
  await q;
  return NextResponse.json({ ok: true });
}
