import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedUserId } from "@/lib/auth/getAuthedUserId";
import { sendUserReportEmail } from "@/lib/email/userReportEmail";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  targetUserId?: string;
  reason?: string;
  excerpt?: string;
  targetType?: string;
  targetId?: string;
};

async function profileLabel(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
): Promise<{ displayName: string; email: string | null }> {
  const [{ data: prof }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  const displayName =
    ((prof?.display_name as string | undefined) || "").trim() ||
    authUser.user?.email?.split("@")[0] ||
    "不明なユーザー";
  return { displayName, email: authUser.user?.email ?? null };
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedUserId(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const targetUserId = body.targetUserId?.trim() || body.targetId?.trim() || "";
  if (!targetUserId) {
    return NextResponse.json({ error: "報告対象のユーザーが指定されていません。" }, { status: 400 });
  }
  if (targetUserId === auth.userId) {
    return NextResponse.json({ error: "自分自身は報告できません。" }, { status: 400 });
  }

  const reason = (body.reason?.trim() || "内容を確認してほしい").slice(0, 1000);
  const excerpt = (body.excerpt?.trim() || "").slice(0, 500);
  const targetType = (body.targetType?.trim() || "profile").slice(0, 40);
  const targetId = (body.targetId?.trim() || targetUserId).slice(0, 120);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "サーバーの DB 設定がありません。" }, { status: 503 });
  }

  const [reported, reporter] = await Promise.all([
    profileLabel(admin, targetUserId),
    profileLabel(admin, auth.userId),
  ]);

  const { error: insertError } = await admin.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    excerpt: excerpt || null,
    reporter_id: auth.userId,
    status: "new",
  });

  // テーブル未作成でもメール通知は送る（運用で SQL 適用前でも機能させる）
  const tableMissing =
    insertError &&
    (insertError.code === "42P01" ||
      insertError.code === "PGRST205" ||
      /relation .* does not exist/i.test(insertError.message));
  if (insertError && !tableMissing) {
    return NextResponse.json({ error: `通報の保存に失敗: ${insertError.message}` }, { status: 500 });
  }

  const mail = await sendUserReportEmail({
    reportedUserId: targetUserId,
    reportedDisplayName: reported.displayName,
    reportedEmail: reported.email,
    reporterUserId: auth.userId,
    reporterDisplayName: reporter.displayName,
    reporterEmail: reporter.email,
    reason,
    excerpt: excerpt || undefined,
    targetType,
  });

  if (!mail.ok) {
    // DB 保存できていれば受付は成功扱い（メール失敗はログ相当で返す）
    return NextResponse.json(
      {
        ok: true,
        emailSent: false,
        warning: mail.error ?? "メール送信に失敗しました",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
