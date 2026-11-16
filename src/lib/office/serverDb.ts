import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OFFICE_ANSWER_MAX,
  OFFICE_ANSWER_MIN,
  OFFICE_NAME_MAX,
  OFFICE_SIMILARITY_THRESHOLD,
} from "@/lib/office/constants";
import { generateIncidentWithClaude, scoreAnswerWithClaude } from "@/lib/office/claude";
import { industryLabelJa, parseOfficeIndustry, type OfficeIndustry } from "@/lib/office/industries";
import { applyRevenueGrowth, calcRevenue } from "@/lib/office/revenue";
import { seasonKeyFor } from "@/lib/office/season";
import { isTooSimilar } from "@/lib/office/similarity";
import { pickIncidentSize } from "@/lib/office/sizePick";
import { computeStamina } from "@/lib/office/stamina";
import { levelFromRevenue } from "@/lib/office/scoring";
import { parseOfficeLeagueId } from "@/lib/office/tiers";
import type {
  OfficeCompany,
  OfficeIncident,
  OfficeSeasonScore,
  OfficeSubmission,
  RankingRow,
} from "@/lib/office/types";

function mapCompany(row: Record<string, unknown>): OfficeCompany {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    industry: parseOfficeIndustry(row.industry),
    totalRevenue: Number(row.total_revenue ?? 0),
    level: Number(row.level ?? 1),
    rankingEnabled: Boolean(row.ranking_enabled ?? true),
    stamina: Number(row.stamina ?? 5),
    staminaUpdatedAt: String(row.stamina_updated_at),
    leagueId: parseOfficeLeagueId(row.league_id),
    createdAt: String(row.created_at),
  };
}

function mapIncident(row: Record<string, unknown>): OfficeIncident {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyId: String(row.company_id),
    title: String(row.title),
    description: String(row.description),
    type: row.type as OfficeIncident["type"],
    size: Number(row.size) as 1 | 2 | 3,
    status: row.status as OfficeIncident["status"],
    createdAt: String(row.created_at),
  };
}

function mapSubmission(row: Record<string, unknown>): OfficeSubmission {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyId: String(row.company_id),
    incidentId: String(row.incident_id),
    answer: String(row.answer),
    scoreSolve: Number(row.score_solve),
    scoreFun: Number(row.score_fun),
    scoreFeasible: Number(row.score_feasible),
    scoreTotal: Number(row.score_total),
    comment: String(row.comment),
    revenue: Number(row.revenue),
    wasSimilar: Boolean(row.was_similar),
    seasonKey: String(row.season_key),
    createdAt: String(row.created_at),
  };
}

function mapSeason(row: Record<string, unknown>): OfficeSeasonScore {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    seasonKey: String(row.season_key),
    leagueId: parseOfficeLeagueId(row.league_id),
    revenue: Number(row.revenue ?? 0),
    rank: row.rank == null ? null : Number(row.rank),
    result: (row.result as OfficeSeasonScore["result"]) ?? null,
    resultSeen: Boolean(row.result_seen),
    createdAt: String(row.created_at),
  };
}

async function ensureSeasonRow(
  admin: SupabaseClient,
  userId: string,
  leagueId: string,
): Promise<OfficeSeasonScore> {
  const key = seasonKeyFor();
  const { data: existing } = await admin
    .from("office_season_scores")
    .select("*")
    .eq("user_id", userId)
    .eq("season_key", key)
    .maybeSingle();
  if (existing) return mapSeason(existing as Record<string, unknown>);

  const { data, error } = await admin
    .from("office_season_scores")
    .insert({ user_id: userId, season_key: key, league_id: leagueId, revenue: 0 })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "season create failed");
  return mapSeason(data as Record<string, unknown>);
}

export async function dbGetCompany(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("office_companies").select("*").eq("user_id", userId).maybeSingle();
  if (!data) {
    return {
      company: null as OfficeCompany | null,
      stamina: computeStamina(5, new Date()),
      seasonRevenue: 0,
      pendingResult: null as OfficeSeasonScore | null,
    };
  }
  const company = mapCompany(data as Record<string, unknown>);
  const stamina = computeStamina(company.stamina, new Date(company.staminaUpdatedAt));
  if (
    stamina.value !== company.stamina ||
    stamina.updatedAt.toISOString() !== company.staminaUpdatedAt
  ) {
    await admin
      .from("office_companies")
      .update({
        stamina: stamina.value,
        stamina_updated_at: stamina.updatedAt.toISOString(),
        level: levelFromRevenue(company.totalRevenue),
      })
      .eq("user_id", userId);
    company.stamina = stamina.value;
    company.staminaUpdatedAt = stamina.updatedAt.toISOString();
  }
  const season = await ensureSeasonRow(admin, userId, company.leagueId);
  const { data: pending } = await admin
    .from("office_season_scores")
    .select("*")
    .eq("user_id", userId)
    .not("result", "is", null)
    .eq("result_seen", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    company,
    stamina,
    seasonRevenue: season.revenue,
    pendingResult: pending ? mapSeason(pending as Record<string, unknown>) : null,
  };
}

export async function dbCreateCompany(
  admin: SupabaseClient,
  userId: string,
  name: string,
  industry: OfficeIndustry,
) {
  const trimmed = name.trim().slice(0, OFFICE_NAME_MAX);
  if (trimmed.length < 1) throw new Error("会社名を入力してね");
  if (!parseOfficeIndustry(industry)) throw new Error("系統を選んでね");
  const { data: existing } = await admin
    .from("office_companies")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) throw new Error("すでに会社があるよ");

  const { data, error } = await admin
    .from("office_companies")
    .insert({
      user_id: userId,
      name: trimmed,
      industry,
      league_id: "rookie",
      stamina: 5,
      stamina_updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  const company = mapCompany(data as Record<string, unknown>);
  await ensureSeasonRow(admin, userId, company.leagueId);
  return company;
}

/** 既存会社の industry が null のときだけ補完（変更不可） */
export async function dbSetIndustry(admin: SupabaseClient, userId: string, industry: OfficeIndustry) {
  if (!parseOfficeIndustry(industry)) throw new Error("系統を選んでね");
  const { data: row } = await admin
    .from("office_companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) throw new Error("会社がないよ");
  const company = mapCompany(row as Record<string, unknown>);
  if (company.industry) throw new Error("系統はもう決め済みだよ");
  const { data, error } = await admin
    .from("office_companies")
    .update({ industry })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "update failed");
  return mapCompany(data as Record<string, unknown>);
}

export async function dbCurrentIncident(
  admin: SupabaseClient,
  userId: string,
): Promise<{ incident: OfficeIncident; created: boolean }> {
  const { data: companyRow } = await admin
    .from("office_companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!companyRow) throw new Error("先に会社を作ってね");
  const company = mapCompany(companyRow as Record<string, unknown>);
  if (!company.industry) throw new Error("先に系統を選んでね");

  const { data: open } = await admin
    .from("office_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (open) return { incident: mapIncident(open as Record<string, unknown>), created: false };

  const { data: recentRows } = await admin
    .from("office_incidents")
    .select("title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  const recentTitles = (recentRows ?? []).map((r) => String((r as { title: string }).title));

  const gen = await generateIncidentWithClaude({
    companyName: company.name,
    industryLabel: industryLabelJa(company.industry),
    recentTitles,
  });
  if (!gen.ok) throw new Error(gen.message);

  const { data, error } = await admin
    .from("office_incidents")
    .insert({
      user_id: userId,
      company_id: company.id,
      title: gen.title,
      description: gen.description,
      type: gen.type,
      size: pickIncidentSize(),
      status: "open",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "incident create failed");
  return { incident: mapIncident(data as Record<string, unknown>), created: true };
}

export async function dbSubmit(admin: SupabaseClient, userId: string, answer: string) {
  const text = answer.trim();
  if (text.length < OFFICE_ANSWER_MIN || text.length > OFFICE_ANSWER_MAX) {
    throw new Error(`回答は${OFFICE_ANSWER_MIN}〜${OFFICE_ANSWER_MAX}文字だよ`);
  }

  const { data: companyRow } = await admin
    .from("office_companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!companyRow) throw new Error("先に会社を作ってね");
  const company = mapCompany(companyRow as Record<string, unknown>);

  const { data: incidentRow } = await admin
    .from("office_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (!incidentRow) throw new Error("事件がないよ");
  const incident = mapIncident(incidentRow as Record<string, unknown>);

  const { data: consumeRows, error: consumeErr } = await admin.rpc("office_consume_stamina", {
    p_user_id: userId,
  });
  if (consumeErr) throw new Error(consumeErr.message);
  const consume = Array.isArray(consumeRows) ? consumeRows[0] : consumeRows;
  if (!consume?.ok) throw new Error("スタミナが足りないよ");

  const scored = await scoreAnswerWithClaude({
    title: incident.title,
    description: incident.description,
    answer: text,
  });
  if (!scored.ok) {
    await admin.rpc("office_restore_stamina", { p_user_id: userId });
    throw new Error(scored.message);
  }

  const { data: recentRows } = await admin
    .from("office_submissions")
    .select("answer")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  const recent = (recentRows ?? []).map((r) => String((r as { answer: string }).answer));
  const wasSimilar = isTooSimilar(text, recent, OFFICE_SIMILARITY_THRESHOLD);
  const revenue = calcRevenue({
    scoreTotal: scored.scores.total,
    size: incident.size,
    wasSimilar,
  });
  const growth = applyRevenueGrowth(company.totalRevenue, revenue);
  const season = await ensureSeasonRow(admin, userId, company.leagueId);

  const { error: incErr } = await admin
    .from("office_incidents")
    .update({ status: "solved" })
    .eq("id", incident.id)
    .eq("user_id", userId);
  if (incErr) {
    await admin.rpc("office_restore_stamina", { p_user_id: userId });
    throw new Error(incErr.message);
  }

  const { data: subRow, error: subErr } = await admin
    .from("office_submissions")
    .insert({
      user_id: userId,
      company_id: company.id,
      incident_id: incident.id,
      answer: text,
      score_solve: scored.scores.solve,
      score_fun: scored.scores.fun,
      score_feasible: scored.scores.feasible,
      score_total: scored.scores.total,
      comment: scored.scores.comment,
      revenue,
      was_similar: wasSimilar,
      season_key: season.seasonKey,
    })
    .select("*")
    .single();
  if (subErr || !subRow) {
    await admin.rpc("office_restore_stamina", { p_user_id: userId });
    await admin.from("office_incidents").update({ status: "open" }).eq("id", incident.id);
    throw new Error(subErr?.message ?? "submit failed");
  }

  await admin
    .from("office_companies")
    .update({
      total_revenue: growth.totalRevenue,
      level: growth.level,
    })
    .eq("user_id", userId);

  await admin
    .from("office_season_scores")
    .update({
      revenue: season.revenue + revenue,
      league_id: company.leagueId,
    })
    .eq("id", season.id);

  const refreshed = await dbGetCompany(admin, userId);
  return {
    submission: mapSubmission(subRow as Record<string, unknown>),
    company: refreshed.company!,
    seasonRevenue: refreshed.seasonRevenue,
    stamina: refreshed.stamina,
  };
}

export async function dbToggleRanking(admin: SupabaseClient, userId: string, enabled: boolean) {
  const { data, error } = await admin
    .from("office_companies")
    .update({ ranking_enabled: enabled })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "toggle failed");
  return mapCompany(data as Record<string, unknown>);
}

export async function dbRanking(admin: SupabaseClient, userId: string) {
  const info = await dbGetCompany(admin, userId);
  const seasonKey = seasonKeyFor();
  const leagueId = info.company?.leagueId ?? "rookie";
  const { data } = await admin
    .from("office_season_scores")
    .select("user_id, revenue, rank, office_companies!inner(name, ranking_enabled, league_id)")
    .eq("season_key", seasonKey)
    .eq("league_id", leagueId)
    .eq("office_companies.ranking_enabled", true)
    .order("revenue", { ascending: false })
    .limit(50);

  const rows: RankingRow[] = (data ?? []).map((raw, i) => {
    const r = raw as {
      user_id: string;
      revenue: number;
      rank: number | null;
      office_companies: { name: string } | { name: string }[];
    };
    const co = Array.isArray(r.office_companies) ? r.office_companies[0] : r.office_companies;
    return {
      rank: r.rank ?? i + 1,
      companyName: co?.name ?? "？",
      revenue: Number(r.revenue ?? 0),
      userId: r.user_id,
      isMe: r.user_id === userId,
    };
  });

  // rank 未確定ならその場で通し番号
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  return {
    seasonKey,
    leagueId,
    rows,
    myRank: rows.find((r) => r.userId === userId)?.rank ?? null,
    rankingEnabled: info.company?.rankingEnabled ?? true,
  };
}

export async function dbMarkResultSeen(admin: SupabaseClient, userId: string, seasonKey: string) {
  await admin
    .from("office_season_scores")
    .update({ result_seen: true })
    .eq("user_id", userId)
    .eq("season_key", seasonKey);
}
