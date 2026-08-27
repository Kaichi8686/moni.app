import type { SupabaseClient } from "@supabase/supabase-js";

export type MentorListing = {
  id: string;
  userId: string;
  displayName: string;
  expertise: string[];
  bio: string | null;
  sessionType: string;
  pricePer30min: number;
  rating: number;
  sessionCount: number;
};

export async function loadActiveMentors(client: SupabaseClient, limit = 24): Promise<MentorListing[]> {
  const { data, error } = await client
    .from("mentors")
    .select("id,user_id,expertise,bio,session_type,price_per_30min,rating,session_count,profiles:user_id(display_name)")
    .eq("is_active", true)
    .order("session_count", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const prof = r.profiles as unknown;
    const p = (Array.isArray(prof) ? prof[0] : prof) as { display_name?: string } | null;
    return {
      id: r.id as string,
      userId: r.user_id as string,
      displayName: (p?.display_name as string)?.trim() || "メンター",
      expertise: (r.expertise as string[]) ?? [],
      bio: (r.bio as string | null) ?? null,
      sessionType: r.session_type as string,
      pricePer30min: (r.price_per_30min as number) ?? 0,
      rating: Number(r.rating) || 0,
      sessionCount: (r.session_count as number) ?? 0,
    };
  });
}

export async function requestMentorSession(
  client: SupabaseClient,
  menteeId: string,
  mentorId: string,
  notes?: string,
) {
  const { error } = await client.from("mentor_sessions").insert({
    mentor_id: mentorId,
    mentee_id: menteeId,
    notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function registerAsMentor(
  client: SupabaseClient,
  userId: string,
  input: { expertise: string[]; bio: string; sessionType: string; pricePer30min: number },
) {
  const { error } = await client.from("mentors").upsert(
    {
      user_id: userId,
      expertise: input.expertise,
      bio: input.bio.trim(),
      session_type: input.sessionType,
      price_per_30min: input.pricePer30min,
      is_active: true,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
