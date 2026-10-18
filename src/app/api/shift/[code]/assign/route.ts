import { NextResponse } from "next/server";
import {
  assignShifts,
  buildManualAssignments,
  formatAssignmentsForLine,
} from "@/lib/shift/assign";
import { getBundle, saveAssignments } from "@/lib/shift/store";
import type { ManualCellInput } from "@/lib/shift/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** 自動割り振り */
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
      return bad("メンバーがまだいません。名前を追加してください");
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

/** 手動割り振りの保存 */
export async function PUT(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  let body: { adminKey?: string; cells?: ManualCellInput[] };
  try {
    body = await req.json();
  } catch {
    return bad("JSON が不正です");
  }

  if (!body.adminKey) return bad("管理者キーが必要です", 403);
  if (!Array.isArray(body.cells)) return bad("割り振りデータが不正です");

  try {
    const bundle = await getBundle(code);
    if (!bundle) return bad("見つかりません", 404);
    if (body.adminKey !== bundle.board.adminKey) {
      return bad("管理者キーが違います", 403);
    }

    const assignments = buildManualAssignments(bundle.board, bundle.responses, body.cells);
    const board = await saveAssignments(code, body.adminKey, assignments);
    const lineText = formatAssignmentsForLine(board, assignments);

    return NextResponse.json({
      ok: true,
      assignments,
      lineText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存に失敗しました";
    if (msg === "DOUBLE_BOOKED") {
      return bad("同じ時間帯に同じ人を二重に入れています");
    }
    if (msg === "UNKNOWN_MEMBER") return bad("名簿にないメンバーが含まれています");
    if (msg === "INVALID_CELL") return bad("時間帯または役割が不正です");
    if (msg === "FORBIDDEN") return bad("管理者キーが違います", 403);
    if (msg === "NOT_FOUND") return bad("見つかりません", 404);
    return bad(msg, 500);
  }
}
