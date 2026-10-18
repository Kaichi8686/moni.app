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
  let body: Partial<BunkasaiSnapshot> & { room?: string; allowEmptyMembers?: boolean };
  try {
    body = (await req.json()) as Partial<BunkasaiSnapshot> & {
      room?: string;
      allowEmptyMembers?: boolean;
    };
  } catch {
    return bad("JSON が不正です");
  }

  try {
    const room = body.room ?? new URL(req.url).searchParams.get("room");
    const existing = await loadSnapshot(room);
    const incomingMembers = Array.isArray(body.members) ? body.members : null;

    // 名簿を空で上書きしない（誤同期で消える事故防止）
    let members = existing.members;
    if (incomingMembers && incomingMembers.length > 0) {
      members = incomingMembers;
    } else if (
      incomingMembers &&
      incomingMembers.length === 0 &&
      body.allowEmptyMembers === true
    ) {
      members = [];
    } else if (incomingMembers && incomingMembers.length === 0 && existing.members.length === 0) {
      members = [];
    }

    const snapshot = await saveSnapshot({
      room,
      members,
      assignments: body.assignments ?? existing.assignments,
      warnings: body.warnings ?? existing.warnings,
      lastAssignedAt:
        body.lastAssignedAt !== undefined ? body.lastAssignedAt : existing.lastAssignedAt,
      coreMemberIds: body.coreMemberIds ?? existing.coreMemberIds,
      dependencies: body.dependencies ?? existing.dependencies,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存に失敗しました";
    if (msg === "MEMBERS_TOO_MANY") return bad("メンバーは200人までです");
    return bad(msg, 500);
  }
}
