import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbCurrentIncident } from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** 未解決の事件を返す。なければ新規生成 */
export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const incident = await dbCurrentIncident(admin, auth.userId);
    return NextResponse.json({ incident });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
