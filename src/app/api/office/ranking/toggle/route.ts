import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbToggleRanking } from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const body = (await req.json()) as { enabled?: boolean };
    const company = await dbToggleRanking(admin, auth.userId, Boolean(body.enabled));
    return NextResponse.json({ company });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
