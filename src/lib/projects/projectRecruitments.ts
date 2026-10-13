import type { SupabaseClient } from "@supabase/supabase-js";
import { createSkillRequest } from "@/lib/discover/skillRequests";

export type ProjectRecruitmentStatus = "open" | "closed";

export type ProjectRecruitment = {
  id: string;
  projectId: string;
  createdBy: string;
  title: string;
  message: string;
  skillName: string;
  duration: string;
  compensation: string;
  skillRequestId: string | null;
  status: ProjectRecruitmentStatus;
  createdAt: string;
  closedAt: string | null;
  projectName?: string;
  projectThumbnailUrl?: string | null;
  projectBusinessType?: string | null;
  projectOwnerId?: string;
};

/** null = 未判定 / true = 専用テーブルあり / false = skill_requests フォールバック */
let dedicatedTableAvailable: boolean | null = null;

function mapRow(row: Record<string, unknown>): ProjectRecruitment {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    createdBy: row.created_by as string,
    title: ((row.title as string | null) ?? "").trim(),
    message: ((row.message as string | null) ?? "").trim(),
    skillName: ((row.skill_name as string | null) ?? "").trim(),
    duration: ((row.duration as string | null) ?? "1週間").trim() || "1週間",
    compensation:
      ((row.compensation as string | null) ?? "なし（経験・実績として）").trim() ||
      "なし（経験・実績として）",
    skillRequestId: (row.skill_request_id as string | null) ?? null,
    status: (row.status as ProjectRecruitmentStatus) === "closed" ? "closed" : "open",
    createdAt: row.created_at as string,
    closedAt: (row.closed_at as string | null) ?? null,
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("project_recruitments")
  );
}

function mapSkillRequestRow(row: Record<string, unknown>): ProjectRecruitment {
  const description = ((row.description as string | null) ?? "").trim();
  // "プロジェクト名 — 本文" 形式なら本文だけ取り出す
  let message = description;
  const sep = " — ";
  const idx = description.indexOf(sep);
  if (idx >= 0) message = description.slice(idx + sep.length).trim();

  const skillName = ((row.skill_name as string | null) ?? "").trim();
  const statusRaw = ((row.status as string | null) ?? "open").toLowerCase();
  return {
    id: row.id as string,
    projectId: (row.project_id as string | null) ?? "",
    createdBy: row.requester_id as string,
    title: skillName,
    message,
    skillName,
    duration: ((row.duration as string | null) ?? "1週間").trim() || "1週間",
    compensation:
      ((row.compensation as string | null) ?? "なし（経験・実績として）").trim() ||
      "なし（経験・実績として）",
    skillRequestId: row.id as string,
    status: statusRaw === "open" ? "open" : "closed",
    createdAt: row.created_at as string,
    closedAt: null,
  };
}

async function hasDedicatedTable(client: SupabaseClient): Promise<boolean> {
  if (dedicatedTableAvailable !== null) return dedicatedTableAvailable;
  const { error } = await client.from("project_recruitments").select("id").limit(1);
  if (error && isMissingTable(error)) {
    dedicatedTableAvailable = false;
    return false;
  }
  // 権限エラー等でもテーブルはあるとみなす
  dedicatedTableAvailable = true;
  return true;
}

async function syncSummaryFromSkillRequests(
  client: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { data, error } = await client
    .from("skill_requests")
    .select("skill_name,description,created_at")
    .eq("project_id", projectId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const open = data ?? [];
  const titles = open
    .map((r) => ((r.skill_name as string | null) ?? "").trim())
    .filter(Boolean);
  const latestDesc = ((open[0]?.description as string | null) ?? "").trim();
  let latestMessage = latestDesc;
  const sep = " — ";
  const idx = latestDesc.indexOf(sep);
  if (idx >= 0) latestMessage = latestDesc.slice(idx + sep.length).trim();
  await client
    .from("projects")
    .update({
      recruitment_target: titles.join(" / "),
      recruitment_message: latestMessage,
    })
    .eq("id", projectId);
}

/** 公開中の募集タイトルを projects.recruitment_* に同期（既存 Discover 互換） */
export async function syncProjectRecruitmentSummary(
  client: SupabaseClient,
  projectId: string,
): Promise<void> {
  if (!(await hasDedicatedTable(client))) {
    await syncSummaryFromSkillRequests(client, projectId);
    return;
  }
  const { data, error } = await client
    .from("project_recruitments")
    .select("title,message,created_at")
    .eq("project_id", projectId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    if (isMissingTable(error)) {
      dedicatedTableAvailable = false;
      await syncSummaryFromSkillRequests(client, projectId);
      return;
    }
    throw new Error(error.message);
  }
  const open = data ?? [];
  const titles = open.map((r) => ((r.title as string | null) ?? "").trim()).filter(Boolean);
  const latestMessage = ((open[0]?.message as string | null) ?? "").trim();
  await client
    .from("projects")
    .update({
      recruitment_target: titles.join(" / "),
      recruitment_message: latestMessage,
    })
    .eq("id", projectId);
}

async function listFromSkillRequests(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectRecruitment[]> {
  const { data, error } = await client
    .from("skill_requests")
    .select("id,requester_id,project_id,skill_name,description,duration,compensation,status,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => mapSkillRequestRow(row as Record<string, unknown>))
    .filter((r) => r.projectId);
}

export async function listProjectRecruitments(
  client: SupabaseClient,
  projectId: string,
): Promise<ProjectRecruitment[]> {
  if (!(await hasDedicatedTable(client))) {
    return listFromSkillRequests(client, projectId);
  }
  const { data, error } = await client
    .from("project_recruitments")
    .select(
      "id,project_id,created_by,title,message,skill_name,duration,compensation,skill_request_id,status,created_at,closed_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) {
      dedicatedTableAvailable = false;
      return listFromSkillRequests(client, projectId);
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

async function listOpenFromSkillRequests(
  client: SupabaseClient,
  opts?: { limit?: number; excludeProjectIds?: string[] },
): Promise<ProjectRecruitment[]> {
  const limit = opts?.limit ?? 80;
  const { data, error } = await client
    .from("skill_requests")
    .select("id,requester_id,project_id,skill_name,description,duration,compensation,status,created_at")
    .eq("status", "open")
    .not("project_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .map((row) => mapSkillRequestRow(row as Record<string, unknown>))
    .filter((r) => r.projectId);
  return attachPublicProjects(client, rows, opts);
}

async function attachPublicProjects(
  client: SupabaseClient,
  rows: ProjectRecruitment[],
  opts?: { limit?: number; excludeProjectIds?: string[] },
): Promise<ProjectRecruitment[]> {
  const limit = opts?.limit ?? 80;
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  if (projectIds.length === 0) return [];

  const { data: projects, error: projErr } = await client
    .from("projects")
    .select("id,name,thumbnail_url,business_type,owner_id,visibility")
    .in("id", projectIds)
    .eq("visibility", "public");
  if (projErr) throw new Error(projErr.message);

  const byId = new Map(
    (projects ?? []).map((p) => [
      p.id as string,
      {
        name: ((p.name as string | null) ?? "").trim() || "プロジェクト",
        thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
        businessType: (p.business_type as string | null) ?? null,
        ownerId: p.owner_id as string,
      },
    ]),
  );

  const exclude = new Set(opts?.excludeProjectIds ?? []);
  return rows
    .filter((r) => byId.has(r.projectId))
    .filter((r) => !exclude.has(r.projectId))
    .map((r) => {
      const p = byId.get(r.projectId)!;
      return {
        ...r,
        projectName: p.name,
        projectThumbnailUrl: p.thumbnailUrl,
        projectBusinessType: p.businessType,
        projectOwnerId: p.ownerId,
      };
    })
    .slice(0, limit);
}

export async function listOpenRecruitmentsForDiscover(
  client: SupabaseClient,
  opts?: { limit?: number; excludeProjectIds?: string[] },
): Promise<ProjectRecruitment[]> {
  const limit = opts?.limit ?? 80;
  if (!(await hasDedicatedTable(client))) {
    return listOpenFromSkillRequests(client, opts);
  }
  const { data, error } = await client
    .from("project_recruitments")
    .select(
      "id,project_id,created_by,title,message,skill_name,duration,compensation,skill_request_id,status,created_at,closed_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (error) {
    if (isMissingTable(error)) {
      dedicatedTableAvailable = false;
      return listOpenFromSkillRequests(client, opts);
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  return attachPublicProjects(client, rows, opts);
}

async function createViaSkillRequests(
  client: SupabaseClient,
  input: {
    projectId: string;
    userId: string;
    projectName: string;
    title: string;
    message?: string;
    skillName?: string;
    duration?: string;
    compensation?: string;
  },
): Promise<ProjectRecruitment> {
  const title = input.title.trim();
  const skillName = (input.skillName ?? title).trim() || title;
  const description = [input.projectName, input.message?.trim() || title].filter(Boolean).join(" — ");
  const duration = input.duration ?? "1週間";
  const compensation = input.compensation ?? "なし（経験・実績として）";

  const { data, error } = await client
    .from("skill_requests")
    .insert({
      requester_id: input.userId,
      project_id: input.projectId,
      // 欲しい人材を大きく出すため skill_name にタイトルを入れる
      skill_name: title,
      description,
      duration,
      compensation,
      status: "open",
    })
    .select(
      "id,requester_id,project_id,skill_name,description,duration,compensation,status,created_at",
    )
    .single();

  if (error) {
    // insert+select が失敗したら createSkillRequest へ
    try {
      await createSkillRequest(client, input.userId, {
        skillName: title || skillName,
        description,
        projectId: input.projectId,
        duration,
        compensation,
      });
      const list = await listFromSkillRequests(client, input.projectId);
      const created = list.find((r) => r.status === "open" && r.title === title) ?? list[0];
      if (!created) throw new Error(error.message);
      await syncSummaryFromSkillRequests(client, input.projectId);
      return created;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : error.message);
    }
  }

  const created = mapSkillRequestRow(data as Record<string, unknown>);
  await syncSummaryFromSkillRequests(client, input.projectId);
  return created;
}

export async function createProjectRecruitment(
  client: SupabaseClient,
  input: {
    projectId: string;
    userId: string;
    projectName: string;
    title: string;
    message?: string;
    skillName?: string;
    duration?: string;
    compensation?: string;
    postToSkillBoard?: boolean;
    makeProjectPublic?: boolean;
  },
): Promise<ProjectRecruitment> {
  const title = input.title.trim();
  if (!title) throw new Error("欲しい人材を入力してください");

  if (input.makeProjectPublic) {
    await client.from("projects").update({ visibility: "public" }).eq("id", input.projectId);
  }

  if (!(await hasDedicatedTable(client))) {
    return createViaSkillRequests(client, input);
  }

  let skillRequestId: string | null = null;
  if (input.postToSkillBoard !== false) {
    const skillName = (input.skillName ?? title).trim() || title;
    const { data: skillRow, error: skillErr } = await client
      .from("skill_requests")
      .insert({
        requester_id: input.userId,
        project_id: input.projectId,
        skill_name: skillName,
        description: [input.projectName, input.message?.trim() || title].filter(Boolean).join(" — "),
        duration: input.duration ?? "1週間",
        compensation: input.compensation ?? "なし（経験・実績として）",
        status: "open",
      })
      .select("id")
      .maybeSingle();
    if (skillErr) {
      if (!isMissingTable(skillErr) && skillErr.code !== "42P01") {
        try {
          await createSkillRequest(client, input.userId, {
            skillName,
            description: [input.projectName, input.message?.trim() || title].filter(Boolean).join(" — "),
            projectId: input.projectId,
            duration: input.duration ?? "1週間",
            compensation: input.compensation ?? "なし（経験・実績として）",
          });
        } catch {
          /* ignore board failure */
        }
      }
    } else {
      skillRequestId = (skillRow?.id as string | null) ?? null;
    }
  }

  const { data, error } = await client
    .from("project_recruitments")
    .insert({
      project_id: input.projectId,
      created_by: input.userId,
      title,
      message: input.message?.trim() || "",
      skill_name: (input.skillName ?? "").trim(),
      duration: input.duration ?? "1週間",
      compensation: input.compensation ?? "なし（経験・実績として）",
      skill_request_id: skillRequestId,
      status: "open",
    })
    .select(
      "id,project_id,created_by,title,message,skill_name,duration,compensation,skill_request_id,status,created_at,closed_at",
    )
    .single();

  if (error) {
    if (isMissingTable(error)) {
      dedicatedTableAvailable = false;
      return createViaSkillRequests(client, input);
    }
    throw new Error(error.message);
  }

  const created = mapRow(data as Record<string, unknown>);
  await syncProjectRecruitmentSummary(client, input.projectId);
  return created;
}

export async function closeProjectRecruitment(
  client: SupabaseClient,
  recruitmentId: string,
  projectId: string,
): Promise<void> {
  if (!(await hasDedicatedTable(client))) {
    const { error } = await client
      .from("skill_requests")
      .update({ status: "closed" })
      .eq("id", recruitmentId)
      .eq("project_id", projectId);
    if (error) throw new Error(error.message);
    await syncSummaryFromSkillRequests(client, projectId);
    return;
  }

  const { data, error } = await client
    .from("project_recruitments")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", recruitmentId)
    .eq("project_id", projectId)
    .select("skill_request_id")
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      dedicatedTableAvailable = false;
      const { error: skErr } = await client
        .from("skill_requests")
        .update({ status: "closed" })
        .eq("id", recruitmentId)
        .eq("project_id", projectId);
      if (skErr) throw new Error(skErr.message);
      await syncSummaryFromSkillRequests(client, projectId);
      return;
    }
    throw new Error(error.message);
  }

  const skillRequestId = (data?.skill_request_id as string | null) ?? null;
  if (skillRequestId) {
    await client.from("skill_requests").update({ status: "closed" }).eq("id", skillRequestId);
  }

  await syncProjectRecruitmentSummary(client, projectId);
}

/** 旧フィールドだけあるプロジェクトを、初回だけ募集行へ取り込む */
export async function ensureLegacyRecruitmentMigrated(
  client: SupabaseClient,
  opts: {
    projectId: string;
    ownerId: string;
    recruitmentTarget: string;
    recruitmentMessage: string;
  },
): Promise<void> {
  const title = opts.recruitmentTarget.trim();
  if (!title) return;
  const existing = await listProjectRecruitments(client, opts.projectId);
  if (existing.length > 0) return;

  if (!(await hasDedicatedTable(client))) {
    // 複数タイトルが " / " 区切りの場合は先頭だけ移行
    const first = title.split(" / ")[0]?.trim() || title;
    try {
      await client.from("skill_requests").insert({
        requester_id: opts.ownerId,
        project_id: opts.projectId,
        skill_name: first,
        description: opts.recruitmentMessage.trim() || null,
        status: "open",
      });
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await client.from("project_recruitments").insert({
      project_id: opts.projectId,
      created_by: opts.ownerId,
      title,
      message: opts.recruitmentMessage.trim(),
      status: "open",
    });
  } catch {
    /* table missing or RLS — ignore */
  }
}
