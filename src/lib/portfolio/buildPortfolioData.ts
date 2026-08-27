import type { SupabaseClient } from "@supabase/supabase-js";
import { getBadgeDefinition } from "@/lib/gamification/badges";
import { computeMoniTier, MONI_TIER_META, type MoniTier } from "@/lib/gamification/moniTier";
import { loadUserMilestones, type UserMilestone } from "@/lib/gamification/milestones";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { loadProfileView } from "@/lib/profile/profileData";

export type PortfolioProject = {
  id: string;
  name: string;
  description: string | null;
  milestoneCount: number;
  openIssueCount: number;
};

export type PortfolioData = {
  profile: Awaited<ReturnType<typeof loadProfileView>>;
  tier: MoniTier;
  tierMeta: (typeof MONI_TIER_META)[MoniTier];
  badges: { id: string; label: string; icon: string }[];
  milestones: UserMilestone[];
  projects: PortfolioProject[];
  activityStreak: number;
  activityTotal: number;
  postCount: number;
};

export async function buildPortfolioData(
  client: SupabaseClient,
  userId: string,
): Promise<PortfolioData | null> {
  const profile = await loadProfileView(client, userId);
  if (!profile) return null;

  const [gam, milestones, memberRes] = await Promise.all([
    loadProfileGamification(client, userId),
    loadUserMilestones(client, userId, 30),
    client.from("project_members").select("project_id, projects(id,name,description)").eq("user_id", userId),
  ]);

  const projectIds = new Set<string>();
  const projects: PortfolioProject[] = [];
  for (const row of memberRes.data ?? []) {
    const raw = row.projects as unknown;
    const p = (Array.isArray(raw) ? raw[0] : raw) as {
      id: string;
      name: string;
      description: string | null;
    } | null;
    if (!p?.id || projectIds.has(p.id)) continue;
    projectIds.add(p.id);
    const [{ count: ms }, { count: issues }] = await Promise.all([
      client.from("milestones").select("*", { count: "exact", head: true }).eq("project_id", p.id),
      client
        .from("project_issues")
        .select("*", { count: "exact", head: true })
        .eq("project_id", p.id)
        .neq("status", "done"),
    ]);
    projects.push({
      id: p.id,
      name: p.name,
      description: p.description,
      milestoneCount: ms ?? 0,
      openIssueCount: issues ?? 0,
    });
  }

  const activityTotal = Object.values(gam.activityLog).reduce((a, n) => a + n, 0);
  const tier = computeMoniTier({
    projectCount: projects.length,
    milestoneCount: milestones.length,
    streak: gam.activityStreak,
    badges: gam.badges,
    manualTier: null,
  });

  return {
    profile,
    tier,
    tierMeta: MONI_TIER_META[tier],
    badges: gam.badges.map((b) => {
      const d = getBadgeDefinition(b.id);
      return { id: b.id, label: d?.label ?? b.id, icon: d?.icon ?? "🏅" };
    }),
    milestones,
    projects,
    activityStreak: gam.activityStreak,
    activityTotal,
    postCount: profile.postCount,
  };
}
