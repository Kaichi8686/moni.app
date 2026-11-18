import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { dbUpdateCast } from "@/lib/office/serverDb";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { CastMember } from "@/lib/office/cast";

export async function PATCH(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  try {
    const body = (await req.json()) as {
      owner_name?: string;
      cast?: CastMember[];
    };
    if (!Array.isArray(body.cast) || body.cast.length !== 6) {
      throw new Error("キャストが不正だよ");
    }
    const company = await dbUpdateCast(admin, auth.userId, {
      ownerName: String(body.owner_name ?? ""),
      cast: body.cast,
    });
    return NextResponse.json({ company });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
