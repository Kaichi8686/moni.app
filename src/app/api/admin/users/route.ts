import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { AdminUserRow } from "@/lib/admin/types";
import { deleteAllAuthUsersExcept, deleteAuthUsers, deleteVirtualDemoUsers } from "@/lib/admin/deleteAuthUsers";
import { requireAppAdmin } from "@/lib/auth/requireAppAdmin";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = await requireAppAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY が未設定です。" },
      { status: 503 },
    );
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "80")));

  try {
    const [{ data: profiles, error: profileErr }, authUsersRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id,role,display_name,goal,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      admin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    ]);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const authUsers = authUsersRes.data.users ?? [];
    const authById = new Map(
      authUsers.map((u) => [
        u.id,
        { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null },
      ]),
    );

    const ids = (profiles ?? []).map((p) => p.id as string);
    const [projectRows, postRows] = await Promise.all([
      ids.length
        ? admin.from("projects").select("owner_id").in("owner_id", ids)
        : Promise.resolve({ data: [] as Array<{ owner_id: string }> }),
      ids.length
        ? admin.from("posts").select("author_id").in("author_id", ids)
        : Promise.resolve({ data: [] as Array<{ author_id: string }> }),
    ]);

    const projectCountByUser = new Map<string, number>();
    for (const row of projectRows.data ?? []) {
      const id = row.owner_id as string;
      projectCountByUser.set(id, (projectCountByUser.get(id) ?? 0) + 1);
    }
    const postCountByUser = new Map<string, number>();
    for (const row of postRows.data ?? []) {
      const id = row.author_id as string;
      postCountByUser.set(id, (postCountByUser.get(id) ?? 0) + 1);
    }

    const users: AdminUserRow[] = (profiles ?? []).map((p) => {
      const id = p.id as string;
      const a = authById.get(id);
      return {
        id,
        email: a?.email ?? null,
        displayName: (p.display_name as string | null) ?? null,
        role: (p.role as string) || "unknown",
        goal: (p.goal as string | null) ?? null,
        createdAt: p.created_at as string,
        lastSignInAt: a?.lastSignInAt ?? null,
        projectCount: projectCountByUser.get(id) ?? 0,
        postCount: postCountByUser.get(id) ?? 0,
      };
    });

    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ユーザー一覧の取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type DeleteBody = {
  userId?: string;
  userIds?: string[];
  /** true のとき、呼び出し元管理者以外の auth ユーザーをすべて削除 */
  purgeOthers?: boolean;
  /** true のとき、ゆい・みさき等のデモ仮想ユーザーのみ削除 */
  deleteVirtualDemo?: boolean;
};

export async function DELETE(req: NextRequest) {
  const auth = await requireAppAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY が未設定です。" },
      { status: 503 },
    );
  }

  let body: DeleteBody = {};
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    body = {};
  }

  try {
    const result = body.deleteVirtualDemo
      ? await deleteVirtualDemoUsers(admin, auth.userId)
      : body.purgeOthers
        ? await deleteAllAuthUsersExcept(admin, auth.userId)
        : await deleteAuthUsers(
            admin,
            body.userIds?.length ? body.userIds : body.userId ? [body.userId] : [],
            auth.userId,
          );

    if (!body.purgeOthers && !body.deleteVirtualDemo && result.deletedIds.length === 0 && result.failed.length === 0) {
      return NextResponse.json({ error: "削除対象の userId が指定されていません。" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedIds.length,
      deletedIds: result.deletedIds,
      failed: result.failed,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ユーザーの削除に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
