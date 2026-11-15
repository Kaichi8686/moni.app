import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { parseOfficeIndustry } from "@/lib/office/industries";
import {
  dbCreateCompany,
  dbGetCompany,
  dbMarkResultSeen,
  dbSetIndustry,
} from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const data = await dbGetCompany(admin, auth.userId);
    return NextResponse.json({
      company: data.company,
      stamina: {
        value: data.stamina.value,
        nextRecoverAt: data.stamina.nextRecoverAt?.toISOString() ?? null,
      },
      seasonRevenue: data.seasonRevenue,
      pendingResult: data.pendingResult,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const body = (await req.json()) as {
      name?: string;
      industry?: string;
      markResultSeen?: string;
    };
    if (body.markResultSeen) {
      await dbMarkResultSeen(admin, auth.userId, body.markResultSeen);
      return NextResponse.json({ ok: true });
    }

    const industry = parseOfficeIndustry(body.industry);
    const existing = await dbGetCompany(admin, auth.userId);

    // 既存会社の業種補完
    if (existing.company && !existing.company.industry) {
      if (!industry) throw new Error("業種を選んでね");
      const company = await dbSetIndustry(admin, auth.userId, industry);
      return NextResponse.json({ company });
    }

    if (existing.company) throw new Error("すでに会社があるよ");
    if (!industry) throw new Error("業種を選んでね");
    const company = await dbCreateCompany(admin, auth.userId, body.name ?? "", industry);
    return NextResponse.json({ company });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
