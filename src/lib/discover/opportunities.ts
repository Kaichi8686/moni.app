import type { SupabaseClient } from "@supabase/supabase-js";

export type OpportunityType = "contest" | "grant" | "internship" | "event";

export type Opportunity = {
  id: string;
  type: OpportunityType;
  title: string;
  organizer: string | null;
  description: string | null;
  prize: string | null;
  deadline: string | null;
  url: string | null;
  tags: string[];
  isVerified: boolean;
  createdAt: string;
};

const TYPE_LABEL: Record<OpportunityType, string> = {
  contest: "ビジコン",
  grant: "補助金・助成",
  internship: "インターン",
  event: "イベント",
};

export function opportunityTypeLabel(t: OpportunityType) {
  return TYPE_LABEL[t] ?? t;
}

export async function loadOpportunities(client: SupabaseClient, limit = 40): Promise<Opportunity[]> {
  const { data, error } = await client
    .from("opportunities")
    .select("id,type,title,organizer,description,prize,deadline,url,tags,is_verified,created_at")
    .order("is_verified", { ascending: false })
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    type: r.type as OpportunityType,
    title: r.title as string,
    organizer: (r.organizer as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    prize: (r.prize as string | null) ?? null,
    deadline: (r.deadline as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    tags: (r.tags as string[]) ?? [],
    isVerified: Boolean(r.is_verified),
    createdAt: r.created_at as string,
  }));
}

export async function createOpportunity(
  client: SupabaseClient,
  userId: string,
  input: Omit<Opportunity, "id" | "isVerified" | "createdAt">,
) {
  const { error } = await client.from("opportunities").insert({
    type: input.type,
    title: input.title.trim(),
    organizer: input.organizer?.trim() || null,
    description: input.description?.trim() || null,
    prize: input.prize?.trim() || null,
    deadline: input.deadline,
    url: input.url?.trim() || null,
    tags: input.tags,
    submitted_by: userId,
  });
  if (error) throw new Error(error.message);
}
