import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminStatsPayload, AdminUserRow } from "@/lib/admin/types";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function countTable(admin: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

function buildSignupSeries(
  profiles: Array<{ created_at: string }>,
  days: number,
): AdminStatsPayload["signupsLast14Days"] {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const p of profiles) {
    const key = p.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

export async function fetchAdminStats(admin: SupabaseClient): Promise<AdminStatsPayload> {
  const [
    authUsersRes,
    profilesRes,
    projectsCount,
    postsCount,
    articlesCount,
    pitchesCount,
    chatCount,
    followsCount,
    ideaQuestionsCount,
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    admin.from("profiles").select("id,role,display_name,goal,created_at").order("created_at", { ascending: false }),
    countTable(admin, "projects"),
    countTable(admin, "posts"),
    countTable(admin, "articles"),
    countTable(admin, "pitches"),
    countTable(admin, "chat_messages"),
    countTable(admin, "follows"),
    countTable(admin, "idea_questions"),
  ]);

  const authUsers = authUsersRes.data.users ?? [];
  const profiles = profilesRes.data ?? [];

  const authById = new Map(
    authUsers.map((u) => [
      u.id,
      { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null },
    ]),
  );

  const roleBreakdownMap = new Map<string, number>();
  for (const p of profiles) {
    const r = (p.role as string) || "unknown";
    roleBreakdownMap.set(r, (roleBreakdownMap.get(r) ?? 0) + 1);
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeLast7Days = authUsers.filter((u) => {
    const t = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    return t >= sevenDaysAgo;
  }).length;

  const profileIds = profiles.slice(0, 80).map((p) => p.id as string);
  const [projectRows, postRows] = await Promise.all([
    profileIds.length
      ? admin.from("projects").select("owner_id").in("owner_id", profileIds)
      : Promise.resolve({ data: [] as Array<{ owner_id: string }> }),
    profileIds.length
      ? admin.from("posts").select("author_id").in("author_id", profileIds)
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

  const recentUsers: AdminUserRow[] = profiles.slice(0, 40).map((p) => {
    const id = p.id as string;
    const auth = authById.get(id);
    return {
      id,
      email: auth?.email ?? null,
      displayName: (p.display_name as string | null) ?? null,
      role: (p.role as string) || "unknown",
      goal: (p.goal as string | null) ?? null,
      createdAt: p.created_at as string,
      lastSignInAt: auth?.lastSignInAt ?? null,
      projectCount: projectCountByUser.get(id) ?? 0,
      postCount: postCountByUser.get(id) ?? 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      authUsers: authUsers.length,
      profiles: profiles.length,
      projects: projectsCount,
      posts: postsCount,
      articles: articlesCount,
      pitches: pitchesCount,
      chatMessages: chatCount,
      follows: followsCount,
      ideaQuestions: ideaQuestionsCount,
    },
    signupsLast14Days: buildSignupSeries(
      profiles.map((p) => ({ created_at: p.created_at as string })),
      14,
    ),
    roleBreakdown: [...roleBreakdownMap.entries()].map(([role, count]) => ({ role, count })),
    activeLast7Days,
    recentUsers,
  };
}
