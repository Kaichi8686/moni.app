import { NextResponse } from "next/server";
import { assignShifts, formatAssignmentsForLine } from "@/lib/shift/assign";
import { createBoard, getBundle, saveAssignments } from "@/lib/shift/store";
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
  if (Array.isArray(body.members) && body.members.length > 80) {
    return bad("メンバーは80人までです");
  }
  if (Array.isArray(body.slots)) {
    if (body.slots.length === 0) return bad("時間帯を1つ以上追加してください");
    if (body.slots.length > 40) return bad("時間帯は40までです");
    const tagged = body.slots.some((s) => Boolean(s.dayId));
    if (tagged) {
      for (let i = 0; i < body.days.length; i++) {
        const dayId = `d${i + 1}`;
        const daySlots = body.slots.filter((s) => s.dayId === dayId);
        if (!daySlots.some((s) => !s.isBreak)) {
          return bad("各日にシフト用の時間帯を1つ以上追加してください");
        }
      }
    } else if (!body.slots.some((s) => !s.isBreak)) {
      return bad("シフト用の時間帯を1つ以上追加してください");
    }
  }

  const schedule = body.schedule ?? DEFAULT_SCHEDULE;

  try {
    const board = await createBoard({ ...body, schedule });
    let assignments = null;
    let lineText = "";

    const wantAuto =
      body.autoAssign !== false && Array.isArray(body.members) && body.members.some((n) => n.trim());

    if (wantAuto) {
      const bundle = await getBundle(board.code);
      if (bundle && bundle.responses.length > 0) {
        assignments = assignShifts(bundle.board, bundle.responses);
        await saveAssignments(board.code, board.adminKey, assignments);
        lineText = formatAssignmentsForLine(board, assignments);
      }
    }

    return NextResponse.json({
      ok: true,
      board: {
        code: board.code,
        adminKey: board.adminKey,
        title: board.title,
        slots: board.slots,
        days: board.days,
        roles: board.roles,
      },
      assignments,
      lineText,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "作成に失敗しました";
    return bad(msg, 500);
  }
}
