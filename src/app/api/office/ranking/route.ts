import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbRanking } from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const data = await dbRanking(admin, auth.userId);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
