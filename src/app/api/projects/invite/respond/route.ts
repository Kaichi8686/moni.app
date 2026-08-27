import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { describeSupabaseAdminConfig, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  inviteId?: string;
  action?: "accept" | "decline";
};

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: describeSupabaseAdminConfig() }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const inviteId = body.inviteId?.trim() ?? "";
  const action = body.action;
  if (!inviteId || (action !== "accept" && action !== "decline")) {
    return NextResponse.json({ error: "inviteId と action が必要です" }, { status: 400 });
  }

  const { data: note, error: nErr } = await admin
    .from("project_notifications")
    .select("id,user_id,project_id,type,body")
    .eq("id", inviteId)
    .maybeSingle();

  if (nErr || !note) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }
  if (note.user_id !== auth.userId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (note.type !== "project_invite") {
    return NextResponse.json({ error: "招待ではありません" }, { status: 400 });
  }

  let payload: {
    v?: number;
    status?: string;
    inviterId?: string;
    projectName?: string;
    message?: string;
  } = {};
  try {
    payload = JSON.parse(note.body as string) as typeof payload;
  } catch {
    return NextResponse.json({ error: "招待データが不正です" }, { status: 400 });
  }
  if (payload.status !== "pending") {
    return NextResponse.json({ error: "すでに処理済みです" }, { status: 409 });
  }

  const projectId = note.project_id as string | null;
  if (!projectId) {
    return NextResponse.json({ error: "プロジェクトが不明です" }, { status: 400 });
  }

  const projectName = payload.projectName?.trim() || "プロジェクト";
  const inviterId = payload.inviterId;

  if (action === "accept") {
    const { error: mErr } = await admin.from("project_members").upsert(
      { project_id: projectId, user_id: auth.userId, role: "member" },
      { onConflict: "project_id,user_id" },
    );
    if (mErr) {
      return NextResponse.json({ error: mErr.message || "参加に失敗しました" }, { status: 500 });
    }
  }

  const nextStatus = action === "accept" ? "accepted" : "declined";
  const { error: uErr } = await admin
    .from("project_notifications")
    .update({
      type: action === "accept" ? "project_invite_resolved" : "project_invite_resolved",
      body: JSON.stringify({ ...payload, status: nextStatus }),
      read_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  if (uErr) {
    return NextResponse.json({ error: uErr.message || "更新に失敗しました" }, { status: 500 });
  }

  if (inviterId) {
    await admin.from("project_notifications").insert({
      user_id: inviterId,
      project_id: projectId,
      type: action === "accept" ? "project_invite_accepted" : "project_invite_declined",
      body:
        action === "accept"
          ? `招待した相手が「${projectName}」への参加を承認しました。`
          : `招待した相手が「${projectName}」への参加を辞退しました。`,
    });
  }

  return NextResponse.json({ ok: true });
}
