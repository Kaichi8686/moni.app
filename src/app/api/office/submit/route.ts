import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbSubmit } from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const body = (await req.json()) as {
      answer?: string;
      strategy_id?: string;
      target_ids?: string[];
      target_other_text?: string | null;
    };
    const result = await dbSubmit(admin, auth.userId, {
      answer: body.answer ?? "",
      strategyId: body.strategy_id ?? "",
      targetIds: Array.isArray(body.target_ids) ? body.target_ids : [],
      targetOtherText: body.target_other_text ?? null,
    });
    return NextResponse.json({
      submission: result.submission,
      company: result.company,
      seasonRevenue: result.seasonRevenue,
      stamina: {
        value: result.stamina.value,
        nextRecoverAt: result.stamina.nextRecoverAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
