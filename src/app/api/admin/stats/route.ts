import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchAdminStats } from "@/lib/admin/fetchAdminStats";
import { requireAppAdmin } from "@/lib/auth/requireAppAdmin";
import { describeSupabaseAdminConfig, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = await requireAppAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    const detail = describeSupabaseAdminConfig();
    return NextResponse.json({ error: detail === "ok" ? "SUPABASE_SERVICE_ROLE_KEY が未設定です。" : detail }, { status: 503 });
  }

  try {
    const stats = await fetchAdminStats(admin);
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "集計に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
