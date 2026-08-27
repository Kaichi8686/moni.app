import type { SupabaseClient } from "@supabase/supabase-js";
import { isAppAdminEmail } from "@/lib/auth/appAdmin";
import { resolveMemberAvatarUrl } from "@/lib/memberAvatar";
import { resolveProfileBio } from "@/lib/profile/resolveBio";
import { parseStringTagArray } from "@/lib/profile/skillsTraits";
import type { FollowListUser, ProfilePost, ProfileProjectHighlight, ProfileView } from "@/lib/profile/types";
import { profileUsername } from "@/lib/profile/username";

const PROFILE_SELECTS = [
  "id,display_name,goal,avatar_url,bio,website,school,location,skills,traits",
  "id,display_name,goal,avatar_url,bio,website,school,location,skills",
  "id,display_name,goal,avatar_url,bio,website,school,location",
  "id,display_name,goal,avatar_url,bio,website",
  "id,display_name,goal,avatar_url",
  "id,display_name,goal",
];

async function fetchProfileRow(client: SupabaseClient, userId: string) {
  for (const sel of PROFILE_SELECTS) {
    const res = await client.from("profiles").select(sel).eq("id", userId).maybeSingle();
    if (!res.error && res.data) return res.data as unknown as Record<string, unknown>;
    const missing =
      res.error?.code === "42703" ||
      /does not exist/i.test(res.error?.message ?? "");
    if (!missing) break;
  }
  return null;
}

/** profiles 行が無いときに作成（ホームの loadRole と同等） */
export async function ensureProfileRow(client: SupabaseClient, userId: string): Promise<boolean> {
  const existing = await fetchProfileRow(client, userId);
  if (existing) return true;

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr) return false;
  const u = userData.user;
  if (!u || u.id !== userId) return false;

  const meta = (u.user_metadata as { display_name?: string } | undefined)?.display_name?.trim();
  const fallbackName = meta || u.email?.split("@")[0] || "ユーザー";
  const initialRole = isAppAdminEmail(u.email) ? "admin" : "child";
  const { error } = await client.from("profiles").upsert({
    id: userId,
    role: initialRole,
    display_name: fallbackName,
    goal: "",
  });
  return !error;
}

export async function loadProfileView(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileView | null> {
  const row = await fetchProfileRow(client, userId);
  if (!row) return null;
  const displayName = ((row.display_name as string) || "ユーザー").trim() || "ユーザー";

  const [{ count: postCount }, { count: followerCount }, { count: followingCount }] = await Promise.all([
    client.from("posts").select("*", { count: "exact", head: true }).eq("author_id", userId),
    client.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    client.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  const avatarUrl = resolveMemberAvatarUrl(userId, (row.avatar_url as string | null) ?? null);

  const school = (row.school as string | null | undefined)?.trim() || null;
  const location = (row.location as string | null | undefined)?.trim() || null;
  const skills = parseStringTagArray(row.skills);
  const traits = parseStringTagArray(row.traits);

  return {
    id: userId,
    displayName,
    username: profileUsername(displayName, userId),
    avatarUrl,
    bio: resolveProfileBio(row as { bio?: string | null; goal?: string | null }),
    website: (row.website as string | null)?.trim() || null,
    ...(school ? { school } : {}),
    ...(location ? { location } : {}),
    ...(skills.length ? { skills } : {}),
    ...(traits.length ? { traits } : {}),
    postCount: postCount ?? 0,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
  };
}

export async function loadProfilePosts(client: SupabaseClient, userId: string): Promise<ProfilePost[]> {
  const { data: rows } = await client
    .from("posts")
    .select("id,caption,image_path,created_at")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);

  return (rows ?? []).map((r) => {
    const path = (r.image_path as string | null) ?? null;
    const { data: pub } = path
      ? client.storage.from("post-images").getPublicUrl(path)
      : { data: { publicUrl: null as string | null } };
    return {
      id: r.id as string,
      caption: (r.caption as string) || "",
      imageUrl: pub.publicUrl,
      createdAt: r.created_at as string,
    };
  });
}

export async function loadProfileProjects(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileProjectHighlight[]> {
  const { data: memberRows } = await client
    .from("project_members")
    .select("project_id, role, projects(id,name,description,thumbnail_url)")
    .eq("user_id", userId)
    .limit(12);

  if (!memberRows?.length) return [];

  return memberRows
    .map((row) => {
      const raw = row.projects as unknown;
      const p = (Array.isArray(raw) ? raw[0] : raw) as {
        id: string;
        name: string;
        description?: string | null;
        thumbnail_url: string | null;
      } | null;
      if (!p?.id) return null;
      const description = (p.description ?? "").trim();
      const item: ProfileProjectHighlight = {
        id: p.id,
        name: p.name,
        icon: p.thumbnail_url ? "🖼" : "📁",
        role: (row as { role?: string }).role ?? "member",
        description: description ? description.slice(0, 60) : undefined,
      };
      return item;
    })
    .filter((x): x is ProfileProjectHighlight => x !== null);
}

export async function loadFollowList(
  client: SupabaseClient,
  profileId: string,
  type: "followers" | "following",
  viewerId: string | null,
): Promise<FollowListUser[]> {
  const idsRes =
    type === "followers"
      ? await client.from("follows").select("follower_id").eq("following_id", profileId)
      : await client.from("follows").select("following_id").eq("follower_id", profileId);

  const ids =
    type === "followers"
      ? ((idsRes.data ?? []) as Array<{ follower_id: string }>).map((r) => r.follower_id)
      : ((idsRes.data ?? []) as Array<{ following_id: string }>).map((r) => r.following_id);

  if (ids.length === 0) return [];

  const { data: profiles } = await client
    .from("profiles")
    .select("id,display_name,goal,avatar_url,bio")
    .in("id", ids);

  let followingSet = new Set<string>();
  let pendingSet = new Set<string>();
  if (viewerId) {
    const [{ data: f }, { data: p }] = await Promise.all([
      client.from("follows").select("following_id").eq("follower_id", viewerId).in("following_id", ids),
      client
        .from("follow_requests")
        .select("following_id")
        .eq("follower_id", viewerId)
        .eq("status", "pending")
        .in("following_id", ids),
    ]);
    followingSet = new Set((f ?? []).map((r) => r.following_id as string));
    pendingSet = new Set((p ?? []).map((r) => r.following_id as string));
  }

  return (profiles ?? []).map((row) => {
    const displayName = ((row.display_name as string) || "ユーザー").trim() || "ユーザー";
    const id = row.id as string;
    return {
      id,
      displayName,
      username: profileUsername(displayName, id),
      avatarUrl: resolveMemberAvatarUrl(id, (row.avatar_url as string | null) ?? null),
      isFollowing: followingSet.has(id),
      isPending: pendingSet.has(id),
    };
  });
}

export async function isFollowingUser(
  client: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  const { data } = await client
    .from("follows")
    .select("follower_id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle();
  return Boolean(data);
}

export async function hasPendingFollowRequest(
  client: SupabaseClient,
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  const { data } = await client
    .from("follow_requests")
    .select("id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .eq("status", "pending")
    .maybeSingle();
  return Boolean(data);
}
