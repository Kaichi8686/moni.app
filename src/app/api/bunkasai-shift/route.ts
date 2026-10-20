import { NextResponse } from "next/server";
import { emptyAssignments } from "@/lib/bunkasai-shift/schedule";
import {
  loadSnapshot,
  mergeMembersPreservingSettings,
  saveSnapshot,
  settingsScore,
  type BunkasaiSnapshot,
} from "@/lib/bunkasai-shift/server-store";
import { normalizeMember } from "@/lib/bunkasai-shift/types";

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
      const normalizedIncoming = incomingMembers.map((m) => normalizeMember(m));
      const incomingScore = settingsScore({
        members: normalizedIncoming,
        coreMemberIds: Array.isArray(body.coreMemberIds)
          ? body.coreMemberIds
          : existing.coreMemberIds,
        dependencies: Array.isArray(body.dependencies)
          ? body.dependencies
          : existing.dependencies,
      });
      const existingScore = settingsScore(existing);
      const existingNgPeople = existing.members.filter((m) => m.ngSlotIds.length > 0).length;
      const incomingNgPeople = normalizedIncoming.filter((m) => m.ngSlotIds.length > 0).length;
      // 一括で NG が消える薄い PUT だけブロック（1人分の解除は通す）
      const looksLikeWipe =
        existingScore > 0 &&
        (incomingScore * 2 < existingScore ||
          (existingNgPeople >= 2 && incomingNgPeople === 0));
      if (looksLikeWipe) {
        members = mergeMembersPreservingSettings(existing.members, normalizedIncoming);
      } else {
        members = normalizedIncoming;
      }
    } else if (
      incomingMembers &&
      incomingMembers.length === 0 &&
      body.allowEmptyMembers === true
    ) {
      members = [];
    } else if (incomingMembers && incomingMembers.length === 0 && existing.members.length === 0) {
      members = [];
    }

    const coreMemberIds =
      Array.isArray(body.coreMemberIds) && body.coreMemberIds.length > 0
        ? body.coreMemberIds
        : Array.isArray(body.coreMemberIds) &&
            body.coreMemberIds.length === 0 &&
            existing.coreMemberIds.length > 0
          ? existing.coreMemberIds
          : (body.coreMemberIds ?? existing.coreMemberIds);

    const dependencies =
      Array.isArray(body.dependencies) && body.dependencies.length > 0
        ? body.dependencies
        : Array.isArray(body.dependencies) &&
            body.dependencies.length === 0 &&
            existing.dependencies.length > 0
          ? existing.dependencies
          : (body.dependencies ?? existing.dependencies);

    const snapshot = await saveSnapshot({
      room,
      members,
      assignments: body.assignments ?? existing.assignments,
      warnings: body.warnings ?? existing.warnings,
      lastAssignedAt:
        body.lastAssignedAt !== undefined ? body.lastAssignedAt : existing.lastAssignedAt,
      coreMemberIds,
      dependencies,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存に失敗しました";
    if (msg === "MEMBERS_TOO_MANY") return bad("メンバーは200人までです");
    return bad(msg, 500);
  }
}
