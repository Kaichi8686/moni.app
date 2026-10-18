import { NextResponse } from "next/server";
import { emptyAssignments } from "@/lib/bunkasai-shift/schedule";
import {
  loadSnapshot,
  saveSnapshot,
  type BunkasaiSnapshot,
} from "@/lib/bunkasai-shift/server-store";

export const runtime = "nodejs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room");
  try {
    const snapshot = await loadSnapshot(room);
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "読み込みに失敗しました";
    return bad(msg, 500);
  }
}

export async function PUT(req: Request) {
  let body: Partial<BunkasaiSnapshot> & { room?: string };
  try {
    body = (await req.json()) as Partial<BunkasaiSnapshot> & { room?: string };
  } catch {
    return bad("JSON が不正です");
  }

  try {
    const snapshot = await saveSnapshot({
      room: body.room ?? new URL(req.url).searchParams.get("room"),
      members: body.members ?? [],
      assignments: body.assignments ?? emptyAssignments(),
      warnings: body.warnings ?? [],
      lastAssignedAt: body.lastAssignedAt ?? null,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存に失敗しました";
    if (msg === "MEMBERS_TOO_MANY") return bad("メンバーは200人までです");
    return bad(msg, 500);
  }
}
