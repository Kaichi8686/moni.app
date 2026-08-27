import type { SupabaseClient } from "@supabase/supabase-js";
import { VIRTUAL_DEMO_DISPLAY_NAMES, VIRTUAL_DEMO_USER_IDS } from "@/lib/admin/virtualDemoUsers";

export type DeleteUsersResult = {
  deletedIds: string[];
  failed: Array<{ id: string; message: string }>;
};

async function listAllAuthUserIds(admin: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ perPage, page });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    for (const u of batch) ids.push(u.id);
    if (batch.length < perPage) break;
    page += 1;
  }
  return ids;
}

export async function deleteAuthUsers(
  admin: SupabaseClient,
  userIds: string[],
  protectedUserId: string,
): Promise<DeleteUsersResult> {
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];

  for (const id of userIds) {
    if (!id || id === protectedUserId) {
      if (id === protectedUserId) {
        failed.push({ id, message: "自分自身は削除できません。" });
      }
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      deletedIds.push(id);
    }
  }

  return { deletedIds, failed };
}

/** ログイン中の管理者以外の auth ユーザーをすべて削除 */
export async function deleteAllAuthUsersExcept(
  admin: SupabaseClient,
  protectedUserId: string,
): Promise<DeleteUsersResult> {
  const allIds = await listAllAuthUserIds(admin);
  const targets = allIds.filter((id) => id !== protectedUserId);
  return deleteAuthUsers(admin, targets, protectedUserId);
}

/** ゆい・みさき等のデモ用仮想ユーザーのみ削除（本番公開前の整理用） */
export async function deleteVirtualDemoUsers(
  admin: SupabaseClient,
  protectedUserId: string,
): Promise<DeleteUsersResult> {
  const idSet = new Set<string>(VIRTUAL_DEMO_USER_IDS);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id,display_name")
    .in("display_name", [...VIRTUAL_DEMO_DISPLAY_NAMES]);

  for (const row of profiles ?? []) {
    const id = row.id as string;
    const name = ((row.display_name as string | null) ?? "").trim();
    if (VIRTUAL_DEMO_DISPLAY_NAMES.includes(name as (typeof VIRTUAL_DEMO_DISPLAY_NAMES)[number])) {
      idSet.add(id);
    }
  }

  return deleteAuthUsers(admin, [...idSet], protectedUserId);
}
