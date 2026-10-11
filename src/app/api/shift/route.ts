import { NextResponse } from "next/server";
import { createBoard } from "@/lib/shift/store";
import type { CreateBoardInput } from "@/lib/shift/types";
import { DEFAULT_SCHEDULE } from "@/lib/shift/types";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  let body: CreateBoardInput;
  try {
    body = (await req.json()) as CreateBoardInput;
  } catch {
    return bad("JSON が不正です");
  }

  if (!body?.title?.trim()) return bad("タイトルを入力してください");
  if (!Array.isArray(body.days) || body.days.length === 0) return bad("日程を1つ以上追加してください");
  if (!Array.isArray(body.roles) || body.roles.length === 0) return bad("役割を1つ以上追加してください");
  if (body.days.length > 14) return bad("日程は14日までです");
  if (body.roles.length > 20) return bad("役割は20までです");

  const schedule = body.schedule ?? DEFAULT_SCHEDULE;

  try {
    const board = await createBoard({ ...body, schedule });
    return NextResponse.json({
      ok: true,
      board: {
        code: board.code,
        adminKey: board.adminKey,
        title: board.title,
        slots: board.slots,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "作成に失敗しました";
    return bad(msg, 500);
  }
}
