import type { SupabaseClient } from "@supabase/supabase-js";

export type RecruitmentApplicationStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type RecruitmentApplication = {
  id: string;
  recruitmentId: string;
  projectId: string;
  applicantId: string;
  message: string;
  status: RecruitmentApplicationStatus;
  joinRequestId: string | null;
  createdAt: string;
  displayName: string;
  avatarUrl: string | null;
};

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("project_recruitment_applications")
  );
}

function mapStatus(raw: unknown): RecruitmentApplicationStatus {
  if (raw === "accepted" || raw === "rejected" || raw === "cancelled") return raw;
  return "pending";
}

export async function listRecruitmentApplications(
  client: SupabaseClient,
  recruitmentId: string,
): Promise<RecruitmentApplication[]> {
  if (!recruitmentId) return [];
  const { data, error } = await client
    .from("project_recruitment_applications")
    .select("id,recruitment_id,project_id,applicant_id,message,status,join_request_id,created_at")
    .eq("recruitment_id", recruitmentId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.applicant_id as string))];
  const { data: profiles } = await client.from("profiles").select("id,display_name,avatar_url").in("id", ids);
  const nameById = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const p of profiles ?? []) {
    nameById.set(p.id as string, {
      name: ((p.display_name as string | null)?.trim() || "ユーザー") as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
    });
  }

  return rows.map((row) => {
    const profile = nameById.get(row.applicant_id as string);
    return {
      id: row.id as string,
      recruitmentId: row.recruitment_id as string,
      projectId: row.project_id as string,
      applicantId: row.applicant_id as string,
      message: ((row.message as string | null) ?? "").trim(),
      status: mapStatus(row.status),
      joinRequestId: (row.join_request_id as string | null) ?? null,
      createdAt: row.created_at as string,
      displayName: profile?.name ?? "ユーザー",
      avatarUrl: profile?.avatarUrl ?? null,
    };
  });
}

/** 募集ごとの pending 件数（一覧バッジ用） */
export async function countPendingApplicationsByRecruitment(
  client: SupabaseClient,
  projectId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!projectId) return map;
  const { data, error } = await client
    .from("project_recruitment_applications")
    .select("recruitment_id")
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (error) {
    if (isMissingTable(error)) return map;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const id = row.recruitment_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/**
 * 探すタブからの応募: 募集応募 +（未申請なら）プロジェクト参加申請
 */
export async function applyToRecruitment(
  client: SupabaseClient,
  input: {
    recruitmentId: string;
    projectId: string;
    applicantId: string;
    message?: string;
  },
): Promise<void> {
  const message = (input.message ?? "").trim();

  let joinRequestId: string | null = null;
  const { data: existingJoin } = await client
    .from("project_join_requests")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("requester_id", input.applicantId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingJoin?.id) {
    joinRequestId = existingJoin.id as string;
  } else {
    const { data: joinRow, error: joinErr } = await client
      .from("project_join_requests")
      .insert({
        project_id: input.projectId,
        requester_id: input.applicantId,
        message: message || "参加したいです",
      })
      .select("id")
      .maybeSingle();
    if (joinErr) throw new Error(joinErr.message);
    joinRequestId = (joinRow?.id as string | null) ?? null;
  }

  const { error } = await client.from("project_recruitment_applications").upsert(
    {
      recruitment_id: input.recruitmentId,
      project_id: input.projectId,
      applicant_id: input.applicantId,
      message,
      status: "pending",
      join_request_id: joinRequestId,
    },
    { onConflict: "recruitment_id,applicant_id" },
  );
  if (error) {
    if (isMissingTable(error) || error.code === "23503") {
      // テーブル未適用 / skill_requests フォールバック ID でも参加申請だけは通す
      return;
    }
    throw new Error(error.message);
  }
}

export async function reviewRecruitmentApplication(
  client: SupabaseClient,
  input: {
    applicationId: string;
    action: "accept" | "reject";
  },
): Promise<void> {
  const { data: app, error: fetchErr } = await client
    .from("project_recruitment_applications")
    .select("id,join_request_id,status")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!app) throw new Error("応募が見つかりません");
  if ((app.status as string) !== "pending") throw new Error("すでに処理済みです");

  const nextStatus = input.action === "accept" ? "accepted" : "rejected";
  const { error: updateErr } = await client
    .from("project_recruitment_applications")
    .update({ status: nextStatus })
    .eq("id", input.applicationId);
  if (updateErr) throw new Error(updateErr.message);

  const joinRequestId = (app.join_request_id as string | null) ?? null;
  if (joinRequestId) {
    const { error: rpcErr } = await client.rpc("project_review_join_request", {
      p_request_id: joinRequestId,
      p_action: input.action,
    });
    // 参加申請が既に処理済みでも応募ステータスは更新済みにする
    if (rpcErr && !/already|処理|status/i.test(rpcErr.message)) {
      throw new Error(rpcErr.message);
    }
  }
}
