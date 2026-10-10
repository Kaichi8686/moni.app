import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStringTagArray } from "@/lib/profile/skillsTraits";

export type TalentHit = {
  id: string;
  displayName: string;
  goal: string;
  role: string | null;
  avatarUrl: string | null;
  skills: string[];
  traits: string[];
};

function matchingKeywords(raw: string): string[] {
  return raw
    .split(/[\s、,，/|・]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
    .slice(0, 8);
}

function sanitizeLikeTerm(term: string): string {
  return term.replace(/[%_,.\\]/g, "").trim();
}

function profileMatchesTerms(hit: TalentHit, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = `${hit.displayName} ${hit.goal} ${hit.skills.join(" ")} ${hit.traits.join(" ")}`.toLowerCase();
  return terms.some((t) => hay.includes(t.toLowerCase()));
}

type ProfileSelectRow = {
  id: string;
  display_name?: string | null;
  goal?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  skills?: unknown;
  traits?: unknown;
};

function mapRow(row: ProfileSelectRow): TalentHit {
  return {
    id: row.id,
    displayName: (row.display_name ?? "").trim() || "ユーザー",
    goal: (row.goal ?? "").trim(),
    role: (row.role as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    skills: parseStringTagArray(row.skills),
    traits: parseStringTagArray(row.traits),
  };
}

function isSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

/**
 * 欲しい人材キーワードでプロフィールを検索（表示名・目標・特技・性格）。
 * skills / traits 列が無い環境ではフォールバックする。
 */
export async function searchTalentByKeywords(
  client: SupabaseClient,
  opts: {
    query: string;
    excludeUserId?: string | null;
    excludeUserIds?: string[];
    limit?: number;
  },
): Promise<TalentHit[]> {
  const terms = matchingKeywords(opts.query).map(sanitizeLikeTerm).filter(Boolean);
  if (terms.length === 0) return [];

  const limit = opts.limit ?? 24;
  const exclude = new Set<string>([
    ...(opts.excludeUserId ? [opts.excludeUserId] : []),
    ...(opts.excludeUserIds ?? []),
  ]);

  const nameGoalOr = terms
    .flatMap((term) => [`goal.ilike.%${term}%`, `display_name.ilike.%${term}%`])
    .join(",");

  const byId = new Map<string, TalentHit>();
  const selects = [
    "id,display_name,goal,role,avatar_url,skills,traits",
    "id,display_name,goal,role,avatar_url,skills",
    "id,display_name,goal,role,avatar_url",
  ] as const;

  let usedSelect: (typeof selects)[number] = "id,display_name,goal,role,avatar_url";
  let loaded = false;

  for (const select of selects) {
    let q = client.from("profiles").select(select).or(nameGoalOr).limit(Math.min(limit * 2, 48));
    if (opts.excludeUserId) q = q.neq("id", opts.excludeUserId);
    const { data, error } = await q;
    if (error) {
      if (isSchemaError(error)) continue;
      throw new Error(error.message);
    }
    usedSelect = select;
    loaded = true;
    for (const row of (data ?? []) as unknown as ProfileSelectRow[]) {
      const hit = mapRow(row);
      if (!exclude.has(hit.id)) byId.set(hit.id, hit);
    }
    break;
  }

  if (!loaded) throw new Error("人材検索に失敗しました");

  if (usedSelect.includes("skills")) {
    for (const term of terms) {
      let q = client.from("profiles").select(usedSelect).contains("skills", [term]).limit(16);
      if (opts.excludeUserId) q = q.neq("id", opts.excludeUserId);
      const { data, error } = await q;
      if (error) {
        if (isSchemaError(error)) break;
        // contains が使えない場合は特技一致なしで続行
        break;
      }
      for (const row of (data ?? []) as unknown as ProfileSelectRow[]) {
        const hit = mapRow(row);
        if (!exclude.has(hit.id)) byId.set(hit.id, hit);
      }
    }
  }

  return [...byId.values()]
    .filter((hit) => profileMatchesTerms(hit, terms))
    .slice(0, limit);
}
