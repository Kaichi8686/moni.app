import type { SupabaseClient } from "@supabase/supabase-js";
import { recordUserActivity } from "@/lib/gamification/recordUserActivity";
import { parseProfileBadges, syncUserBadges } from "@/lib/gamification/syncBadges";

export type MilestoneType =
  | "first_sale"
  | "team_formed"
  | "media"
  | "contest"
  | "funding"
  | "release"
  | "users"
  | "incorporation"
  | "custom";

export const MILESTONE_TYPE_OPTIONS: { type: MilestoneType; label: string; labelEn: string; icon: string }[] = [
  { type: "first_sale", label: "初めての売上", labelEn: "First sale", icon: "💰" },
  { type: "team_formed", label: "チーム結成", labelEn: "Team formed", icon: "🤝" },
  { type: "media", label: "メディア掲載", labelEn: "Media feature", icon: "📣" },
  { type: "contest", label: "コンテスト受賞", labelEn: "Contest award", icon: "🏆" },
  { type: "funding", label: "資金調達", labelEn: "Fundraising", icon: "💎" },
  { type: "release", label: "リリース", labelEn: "Launch", icon: "🚀" },
  { type: "users", label: "ユーザー獲得", labelEn: "Users gained", icon: "👥" },
  { type: "incorporation", label: "法人設立", labelEn: "Incorporation", icon: "📝" },
  { type: "custom", label: "カスタム", labelEn: "Custom", icon: "✏️" },
];

export type UserMilestone = {
  id: string;
  userId: string;
  projectId: string | null;
  type: MilestoneType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  achievedAt: string;
  isPublic: boolean;
};

function mapRow(r: Record<string, unknown>): UserMilestone {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    projectId: (r.project_id as string | null) ?? null,
    type: r.type as MilestoneType,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    achievedAt: r.achieved_at as string,
    isPublic: Boolean(r.is_public),
  };
}

export async function loadUserMilestones(
  client: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<UserMilestone[]> {
  const { data, error } = await client
    .from("milestones")
    .select("id,user_id,project_id,type,title,description,image_url,achieved_at,is_public")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export type CreateMilestoneInput = {
  type: MilestoneType;
  title: string;
  description?: string;
  projectId?: string | null;
  achievedAt: string;
  isPublic?: boolean;
};

export async function createUserMilestone(
  client: SupabaseClient,
  userId: string,
  input: CreateMilestoneInput,
): Promise<UserMilestone> {
  const { data, error } = await client
    .from("milestones")
    .insert({
      user_id: userId,
      project_id: input.projectId ?? null,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      achieved_at: input.achievedAt,
      is_public: input.isPublic !== false,
    })
    .select("id,user_id,project_id,type,title,description,image_url,achieved_at,is_public")
    .single();

  if (error) throw new Error(error.message);

  try {
    await recordUserActivity(client, userId, 2);
  } catch {
    /* ゲーミフィケーション列未適用でもマイルストーン保存は成功させる */
  }

  const { data: prof } = await client.from("profiles").select("badges,activity_streak").eq("id", userId).maybeSingle();
  if (prof) {
    const streak =
      typeof (prof as { activity_streak?: number }).activity_streak === "number"
        ? (prof as { activity_streak: number }).activity_streak
        : 0;
    await syncUserBadges(client, userId, streak, parseProfileBadges((prof as { badges?: unknown }).badges));
  }

  return mapRow(data as Record<string, unknown>);
}

export async function deleteUserMilestone(
  client: SupabaseClient,
  userId: string,
  milestoneId: string,
): Promise<void> {
  const { error } = await client.from("milestones").delete().eq("id", milestoneId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export function milestoneTypeLabel(type: MilestoneType, locale: "ja" | "en" = "ja"): string {
  const opt = MILESTONE_TYPE_OPTIONS.find((o) => o.type === type);
  if (!opt) return type;
  return locale === "en" ? opt.labelEn : opt.label;
}

export function milestoneTypeIcon(type: MilestoneType): string {
  return MILESTONE_TYPE_OPTIONS.find((o) => o.type === type)?.icon ?? "📌";
}
