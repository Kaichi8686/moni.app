import { NextResponse } from "next/server";
import { assignShifts, formatAssignmentsForLine } from "@/lib/shift/assign";
import { getBundle, saveAssignments } from "@/lib/shift/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  let body: { adminKey?: string };
  try {
    body = await req.json();
  } catch {
    return bad("JSON が不正です");
  }

  try {
    const bundle = await getBundle(code);
    if (!bundle) return bad("見つかりません", 404);
    if (!body.adminKey || body.adminKey !== bundle.board.adminKey) {
      return bad("管理者キーが違います", 403);
    }
    if (bundle.responses.length === 0) {
      return bad("まだ希望が届いていません");
    }

    const assignments = assignShifts(bundle.board, bundle.responses);
    const board = await saveAssignments(code, body.adminKey, assignments);
    const lineText = formatAssignmentsForLine(board, assignments);

    return NextResponse.json({
      ok: true,
      assignments,
      lineText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "割り振りに失敗しました";
    if (msg === "FORBIDDEN") return bad("管理者キーが違います", 403);
    if (msg === "NOT_FOUND") return bad("見つかりません", 404);
    return bad(msg, 500);
  }
}
