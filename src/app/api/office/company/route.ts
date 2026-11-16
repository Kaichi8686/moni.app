import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import {
  dbCreateCompany,
  dbGetCompany,
  dbMarkResultSeen,
  dbSetAbout,
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
      about?: string;
      markResultSeen?: string;
    };
    if (body.markResultSeen) {
      await dbMarkResultSeen(admin, auth.userId, body.markResultSeen);
      return NextResponse.json({ ok: true });
    }

    const existing = await dbGetCompany(admin, auth.userId);

    // 既存会社の説明補完
    if (existing.company && !existing.company.about) {
      if (!body.about) throw new Error("会社の説明を書いてね");
      const company = await dbSetAbout(admin, auth.userId, body.about);
      return NextResponse.json({ company });
    }

    if (existing.company) throw new Error("すでに会社があるよ");
    if (!body.about) throw new Error("会社の説明を書いてね");
    const company = await dbCreateCompany(admin, auth.userId, body.name ?? "", body.about);
    return NextResponse.json({ company });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
