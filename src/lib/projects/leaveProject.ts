import { supabase } from "@/lib/supabase";

export type LeaveProjectErrorCode =
  | "not_authenticated"
  | "project_not_found"
  | "owner_must_transfer_first"
  | "not_a_member"
  | "only_current_owner"
  | "new_owner_must_be_member"
  | "already_owner"
  | "supabase_unavailable"
  | "unknown";

export type LeaveProjectResult =
  | { ok: true }
  | { ok: false; error: string; code: LeaveProjectErrorCode };

function isMissingRpc(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("function public.leave_project") ||
    m.includes("schema cache") ||
    (m.includes("leave_project") && m.includes("does not exist"))
  );
}

function classifyError(raw: string): LeaveProjectErrorCode {
  const code = raw.trim();
  if (code.includes("not_authenticated")) return "not_authenticated";
  if (code.includes("project_not_found") || code.includes("invalid_project")) return "project_not_found";
  if (code.includes("owner_must_transfer_first")) return "owner_must_transfer_first";
  if (code.includes("not_a_member")) return "not_a_member";
  if (code.includes("only_current_owner")) return "only_current_owner";
  if (code.includes("new_owner_must_be_member")) return "new_owner_must_be_member";
  if (code.includes("already_owner")) return "already_owner";
  return "unknown";
}

/** UI 向けの既定メッセージ（呼び出し側で tx 上書き推奨） */
export function leaveProjectErrorMessage(code: LeaveProjectErrorCode, fallback?: string): string {
  switch (code) {
    case "not_authenticated":
      return "ログインが必要です。";
    case "project_not_found":
      return "プロジェクトが見つかりません。";
    case "owner_must_transfer_first":
      return "オーナーは先に他のメンバーへ権限を引き継いでから脱退できます。";
    case "not_a_member":
      return "このプロジェクトのメンバーではありません。";
    case "only_current_owner":
      return "オーナーだけが権限を引き継げます。";
    case "new_owner_must_be_member":
      return "引き継ぎ先はプロジェクトのメンバーである必要があります。";
    case "already_owner":
      return "すでにオーナーです。";
    case "supabase_unavailable":
      return "Supabase が未設定です。";
    default:
      return fallback || "脱退に失敗しました。";
  }
}

function fail(code: LeaveProjectErrorCode, fallback?: string): LeaveProjectResult {
  return { ok: false, error: leaveProjectErrorMessage(code, fallback), code };
}

/** RPC 未適用環境向け: オーナー確認のうえ project_members を自己削除 */
async function leaveProjectFallback(projectId: string, uid: string): Promise<LeaveProjectResult> {
  if (!supabase) return fail("supabase_unavailable");

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectErr) return fail("unknown", projectErr.message);
  if (!project) return fail("project_not_found");
  if ((project as { owner_id: string }).owner_id === uid) {
    return fail("owner_must_transfer_first");
  }

  const { error: deleteErr } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", uid);

  if (deleteErr) return fail("unknown", deleteErr.message);

  // best-effort: プロジェクト会話から外す（RLS で失敗しても脱退自体は成功）
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "project")
    .eq("project_id", projectId);

  const convIds = (convs ?? []).map((c) => c.id as string).filter(Boolean);
  if (convIds.length > 0) {
    await supabase.from("conversation_members").delete().in("conversation_id", convIds).eq("user_id", uid);
  }

  return { ok: true };
}

/** 現在のユーザーをプロジェクトから脱退させる */
export async function leaveProject(projectId: string): Promise<LeaveProjectResult> {
  if (!supabase) return fail("supabase_unavailable");
  const client = supabase;

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) return fail("unknown", userErr.message);
  const uid = userData.user?.id;
  if (!uid) return fail("not_authenticated");

  const { error } = await client.rpc("leave_project", { p_project_id: projectId });
  if (!error) return { ok: true };

  if (isMissingRpc(error.message)) {
    return leaveProjectFallback(projectId, uid);
  }

  return fail(classifyError(error.message), error.message);
}

/**
 * オーナーが権限を引き継いだうえで脱退する。
 * 1) transfer_project_owner → 2) leave_project
 */
export async function transferOwnershipAndLeave(
  projectId: string,
  newOwnerId: string,
): Promise<LeaveProjectResult> {
  if (!supabase) return fail("supabase_unavailable");
  const client = supabase;

  const { error: transferErr } = await client.rpc("transfer_project_owner", {
    p_project_id: projectId,
    p_new_owner_id: newOwnerId,
  });
  if (transferErr) {
    return fail(classifyError(transferErr.message), transferErr.message);
  }

  return leaveProject(projectId);
}
