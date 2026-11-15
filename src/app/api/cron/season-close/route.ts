import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/auth/verifyCronSecret";
import { runSeasonClose } from "@/lib/office/seasonClose";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Vercel Cron: 毎日 15:00 UTC（= JST 0:00）。JST 1日のときだけ前月を締める */
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", hint: auth.reason }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const force = url.searchParams.get("forceSeasonKey")?.trim() || undefined;

  const result = await runSeasonClose(admin, new Date(), { forceSeasonKey: force });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
