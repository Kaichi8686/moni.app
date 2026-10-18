import { NextResponse } from "next/server";
import { getBundle, updateBoard, upsertResponse } from "@/lib/shift/store";
import type { Pref, UpdateBoardInput } from "@/lib/shift/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const adminKey = url.searchParams.get("adminKey");

  try {
    const bundle = await getBundle(code);
    if (!bundle) return bad("シフト表が見つかりません", 404);

    const isAdmin = Boolean(adminKey && adminKey === bundle.board.adminKey);
    const publicBoard = {
      id: bundle.board.id,
      code: bundle.board.code,
      title: bundle.board.title,
      note: bundle.board.note,
      days: bundle.board.days,
      slots: bundle.board.slots,
      roles: bundle.board.roles,
      schedule: bundle.board.schedule,
      createdAt: bundle.board.createdAt,
      updatedAt: bundle.board.updatedAt,
      assignments: bundle.board.assignments,
    };

    return NextResponse.json({
      ok: true,
      board: isAdmin ? bundle.board : publicBoard,
      responses: isAdmin
        ? bundle.responses
        : bundle.responses.map((r) => ({
            id: r.id,
            name: r.name,
            updatedAt: r.updatedAt,
          })),
      responseCount: bundle.responses.length,
      isAdmin,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得に失敗しました";
    return bad(msg, 500);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  let body: {
    name?: string;
    prefs?: Record<string, Pref>;
    preferredRoleIds?: string[];
    note?: string;
    responseId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return bad("JSON が不正です");
  }

  const prefs = body.prefs ?? {};
  for (const v of Object.values(prefs)) {
    if (v !== "prefer" && v !== "ok" && v !== "ng") {
      return bad("希望の値が不正です");
    }
  }

  try {
    const response = await upsertResponse(code, {
      name: body.name ?? "",
      prefs,
      preferredRoleIds: Array.isArray(body.preferredRoleIds)
        ? body.preferredRoleIds.map(String).slice(0, 20)
        : [],
      note: body.note,
      responseId: body.responseId,
    });
    return NextResponse.json({ ok: true, response });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存に失敗しました";
    if (msg === "NOT_FOUND") return bad("シフト表が見つかりません", 404);
    if (msg === "NAME_REQUIRED") return bad("名前を入力してください");
    return bad(msg, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  let body: UpdateBoardInput & { adminKey?: string };
  try {
    body = await req.json();
  } catch {
    return bad("JSON が不正です");
  }
  if (!body.adminKey) return bad("管理者キーが必要です", 403);

  try {
    const board = await updateBoard(code, body.adminKey, body);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新に失敗しました";
    if (msg === "NOT_FOUND") return bad("シフト表が見つかりません", 404);
    if (msg === "FORBIDDEN") return bad("管理者キーが違います", 403);
    if (msg === "SLOTS_REQUIRED") return bad("時間帯を1つ以上追加してください");
    return bad(msg, 500);
  }
}
