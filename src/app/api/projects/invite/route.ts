import { NextResponse, type NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { describeSupabaseAdminConfig, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  projectId?: string;
  inviteeId?: string;
  message?: string;
};

/** プロジェクト招待を通知として送る（URL不要・DB新規テーブル不要） */
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

  const projectId = body.projectId?.trim() ?? "";
  const inviteeId = body.inviteeId?.trim() ?? "";
  if (!projectId || !inviteeId) {
    return NextResponse.json({ error: "projectId と inviteeId が必要です" }, { status: 400 });
  }
  if (inviteeId === auth.userId) {
    return NextResponse.json({ error: "自分自身には招待できません" }, { status: 400 });
  }

  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("id,name,owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (pErr || !project) {
    return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  const canInvite = project.owner_id === auth.userId || Boolean(membership);
  if (!canInvite) {
    return NextResponse.json({ error: "招待する権限がありません" }, { status: 403 });
  }

  const { data: already } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", inviteeId)
    .maybeSingle();
  if (already) {
    return NextResponse.json({ error: "すでにメンバーです" }, { status: 409 });
  }

  // 既存の未処理招待があれば再利用
  const { data: existingNotes } = await admin
    .from("project_notifications")
    .select("id,body,created_at")
    .eq("user_id", inviteeId)
    .eq("project_id", projectId)
    .eq("type", "project_invite")
    .order("created_at", { ascending: false })
    .limit(10);

  for (const note of existingNotes ?? []) {
    const parsed = parseInviteBody(note.body as string);
    if (parsed?.status === "pending") {
      return NextResponse.json({
        ok: true,
        invite: {
          id: note.id,
          project_id: projectId,
          inviter_id: parsed.inviterId || auth.userId,
          invitee_id: inviteeId,
          status: "pending",
          message: body.message ?? "",
          created_at: note.created_at,
          resolved_at: null,
        },
      });
    }
  }

  const projectName = (project.name as string)?.trim() || "プロジェクト";
  const payload = {
    v: 1,
    status: "pending" as const,
    inviterId: auth.userId,
    projectName,
    message: body.message ?? "",
  };

  const { data: inserted, error: nErr } = await admin
    .from("project_notifications")
    .insert({
      user_id: inviteeId,
      project_id: projectId,
      type: "project_invite",
      body: JSON.stringify(payload),
    })
    .select("id,project_id,created_at")
    .single();

  if (nErr || !inserted) {
    return NextResponse.json({ error: nErr?.message || "招待の送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    invite: {
      id: inserted.id as string,
      project_id: projectId,
      inviter_id: auth.userId,
      invitee_id: inviteeId,
      status: "pending",
      message: body.message ?? "",
      created_at: inserted.created_at as string,
      resolved_at: null,
    },
  });
}

function parseInviteBody(body: string): { status?: string; inviterId?: string; projectName?: string } | null {
  try {
    const parsed = JSON.parse(body) as { status?: string; inviterId?: string; projectName?: string };
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // legacy plain text
  }
  return null;
}
