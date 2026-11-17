import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OFFICE_ANSWER_MAX,
  OFFICE_ANSWER_MIN,
  OFFICE_NAME_MAX,
  OFFICE_SIMILARITY_THRESHOLD,
  OFFICE_TARGET_OTHER_MAX,
} from "@/lib/office/constants";
import {
  generateIncidentWithClaude,
  regenerateStrategiesWithClaude,
  scoreAnswerWithClaude,
} from "@/lib/office/claude";
import { guessIndustryFromAbout, parseCompanyAbout } from "@/lib/office/about";
import { ensureCompanyCast } from "@/lib/office/cast";
import { industryLabelJa, parseOfficeIndustry } from "@/lib/office/industries";
import {
  defaultStageForType,
  parseIncidentStageFields,
} from "@/lib/office/incidentValidate";
import {
  applyMeterDecay,
  applyMetersDelta,
  computeMetersDelta,
  ensureMeters,
  lowestMeterKey,
} from "@/lib/office/meters";
import { isMangledOfflineDescription, offlineIncident } from "@/lib/office/offline";
import {
  buildResultPanels,
  parseMetersDelta,
  parseResultPanels,
  reactionForTone,
} from "@/lib/office/resultPanels";
import { applyRevenueGrowth, calcRevenue } from "@/lib/office/revenue";
import { seasonKeyFor } from "@/lib/office/season";
import { seasonThemeFor } from "@/lib/office/seasonTheme";
import { isTooSimilar } from "@/lib/office/similarity";
import { pickIncidentSize } from "@/lib/office/sizePick";
import { computeStamina } from "@/lib/office/stamina";
import { levelFromRevenue } from "@/lib/office/scoring";
import {
  parseStrategies,
  parseTargets,
  stripTargetFit,
} from "@/lib/office/strategy";
import { targetsPassValidation } from "@/lib/office/targetValidate";
import { parseOfficeLeagueId } from "@/lib/office/tiers";
import { nextLoginStreak } from "@/lib/office/loginStreak";
import { parseCastEmotion } from "@/lib/office/scenes";
import type {
  IncidentStrategy,
  IncidentTargetInternal,
  OfficeCompany,
  OfficeIncident,
  OfficeSeasonScore,
  OfficeSubmission,
  OfficeSubmitInput,
  RankingRow,
  StrategyKind,
  StoryTone,
} from "@/lib/office/types";

function mapCompany(row: Record<string, unknown>): OfficeCompany {
  const aboutRaw = row.about == null ? null : String(row.about);
  const about = aboutRaw && aboutRaw.trim() ? aboutRaw.trim() : null;
  const industry =
    parseOfficeIndustry(row.industry) ?? guessIndustryFromAbout(about);
  const cast = ensureCompanyCast(row.cast, String(row.id ?? row.user_id ?? "x"));
  const metersUpdatedAt = row.meters_updated_at ? String(row.meters_updated_at) : null;
  const meters = applyMeterDecay(ensureMeters(row.meters), metersUpdatedAt);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    about,
    industry,
    totalRevenue: Number(row.total_revenue ?? 0),
    level: Number(row.level ?? 1),
    rankingEnabled: Boolean(row.ranking_enabled ?? true),
    stamina: Number(row.stamina ?? 5),
    staminaUpdatedAt: String(row.stamina_updated_at),
    leagueId: parseOfficeLeagueId(row.league_id),
    createdAt: String(row.created_at),
    cast,
    meters,
    metersUpdatedAt,
    shareOptOut: Boolean(row.share_opt_out ?? false),
    sfxMuted: row.sfx_muted == null ? true : Boolean(row.sfx_muted),
    secretaryGuideDone: Boolean(row.secretary_guide_done ?? false),
    loginStreak: Number(row.login_streak ?? 0),
    loginLastDate: row.login_last_date == null ? null : String(row.login_last_date).slice(0, 10),
  };
}

/** cast/meters 未設定の既存会社を埋める（失敗しても読み取りは続行） */
async function backfillCastMeters(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const needsCast = row.cast == null;
  const needsMeters = row.meters == null;
  if (!needsCast && !needsMeters) return row;
  const cast = ensureCompanyCast(row.cast, String(row.id ?? "x"));
  const meters = ensureMeters(row.meters);
  const patch: Record<string, unknown> = {};
  if (needsCast) patch.cast = cast;
  if (needsMeters) {
    patch.meters = meters;
    patch.meters_updated_at = new Date().toISOString();
  }
  const { data, error } = await admin
    .from("office_companies")
    .update(patch)
    .eq("id", String(row.id))
    .select("*")
    .single();
  if (error || !data) return { ...row, ...patch };
  return data as Record<string, unknown>;
}

function readTargetsInternal(row: Record<string, unknown>): IncidentTargetInternal[] {
  return parseTargets(row.targets) ?? [];
}

function readStrategies(row: Record<string, unknown>): IncidentStrategy[] {
  return parseStrategies(row.strategies) ?? [];
}

function mapIncident(row: Record<string, unknown>): OfficeIncident {
  const strategies = readStrategies(row);
  const targetsInternal = readTargetsInternal(row);
  const type = row.type as OfficeIncident["type"];
  const stage =
    parseIncidentStageFields({
      scene: row.scene,
      speaker: row.speaker,
      line: row.line,
      stakes: row.stakes,
      meters_at_risk: row.meters_at_risk,
    }) ?? defaultStageForType(type);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyId: String(row.company_id),
    title: String(row.title),
    description: String(row.description),
    type,
    size: Number(row.size) as 1 | 2 | 3,
    status: row.status as OfficeIncident["status"],
    strategies,
    targets: stripTargetFit(targetsInternal),
    strategyRerolls: Math.max(0, Math.min(1, Number(row.strategy_rerolls ?? 0))),
    createdAt: String(row.created_at),
    scene: stage.scene,
    speaker: stage.speaker,
    line: stage.line,
    stakes: stage.stakes,
    metersAtRisk: stage.metersAtRisk,
    followupOf: row.followup_of ? String(row.followup_of) : null,
  };
}

function mapSubmission(row: Record<string, unknown>): OfficeSubmission {
  const targetIdsRaw = row.target_ids;
  const targetIds = Array.isArray(targetIdsRaw)
    ? targetIdsRaw.map((x) => String(x))
    : [];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyId: String(row.company_id),
    incidentId: String(row.incident_id),
    answer: String(row.answer),
    strategyId: String(row.strategy_id ?? "custom"),
    strategyKind: (String(row.strategy_kind ?? "custom") as StrategyKind) || "custom",
    targetIds,
    targetOtherText: row.target_other_text == null ? null : String(row.target_other_text),
    scoreSolve: Number(row.score_solve),
    scoreFun: Number(row.score_fun),
    scoreFeasible: Number(row.score_feasible),
    scoreFit: Number(row.score_fit ?? 0),
    scoreTotal: Number(row.score_total),
    comment: String(row.comment),
    story: String(row.story ?? ""),
    storyTone: (String(row.story_tone ?? "ok") as StoryTone) || "ok",
    nextHint: String(row.next_hint ?? ""),
    multiplier: Number(row.multiplier ?? 1),
    isOriginal: Boolean(row.is_original),
    revenue: Number(row.revenue),
    wasSimilar: Boolean(row.was_similar),
    seasonKey: String(row.season_key),
    createdAt: String(row.created_at),
    panels: parseResultPanels(row.panels),
    strategyTitle: row.strategy_title == null ? null : String(row.strategy_title),
    castMemberId: row.cast_member_id == null ? null : String(row.cast_member_id),
    npcLine: row.npc_line == null ? null : String(row.npc_line),
    reactionEmotion: parseCastEmotion(row.reaction_emotion),
    metersDelta: parseMetersDelta(row.meters_delta),
    safe: row.safe == null ? true : Boolean(row.safe),
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
  const row = await backfillCastMeters(admin, data as Record<string, unknown>);
  const company = mapCompany(row);
  const streak = nextLoginStreak(company.loginStreak ?? 0, company.loginLastDate);
  if (streak.changed) {
    company.loginStreak = streak.streak;
    company.loginLastDate = streak.lastDate;
    const streakPatch = await admin
      .from("office_companies")
      .update({
        login_streak: streak.streak,
        login_last_date: streak.lastDate,
      })
      .eq("user_id", userId);
    if (streakPatch.error) {
      // SQL未適用時はメモリ上のみ
    }
  }
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
  aboutRaw: string,
) {
  const trimmed = name.trim().slice(0, OFFICE_NAME_MAX);
  if (trimmed.length < 1) throw new Error("会社名を入力してね");
  const about = parseCompanyAbout(aboutRaw);
  if (!about) throw new Error("会社の説明を書いてね");
  const industry = guessIndustryFromAbout(about);
  const { data: existing } = await admin
    .from("office_companies")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) throw new Error("すでに会社があるよ");

  const now = new Date().toISOString();
  const cast = ensureCompanyCast(null, userId);
  const meters = ensureMeters(null);
  const { data, error } = await admin
    .from("office_companies")
    .insert({
      user_id: userId,
      name: trimmed,
      about,
      industry,
      league_id: "rookie",
      stamina: 5,
      stamina_updated_at: now,
      cast,
      meters,
      meters_updated_at: now,
      sfx_muted: true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  const company = mapCompany(data as Record<string, unknown>);
  await ensureSeasonRow(admin, userId, company.leagueId);
  return company;
}

/** 既存会社の about が null のときだけ補完（変更不可）。open 事件は破棄して作り直す */
export async function dbSetAbout(admin: SupabaseClient, userId: string, aboutRaw: string) {
  const about = parseCompanyAbout(aboutRaw);
  if (!about) throw new Error("会社の説明を書いてね");
  const { data: row } = await admin
    .from("office_companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) throw new Error("会社がないよ");
  const company = mapCompany(row as Record<string, unknown>);
  if (company.about) throw new Error("説明はもう決め済みだよ");
  const industry = company.industry ?? guessIndustryFromAbout(about);
  const { data, error } = await admin
    .from("office_companies")
    .update({ about, industry })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "update failed");
  await admin.from("office_incidents").delete().eq("user_id", userId).eq("status", "open");
  return mapCompany(data as Record<string, unknown>);
}

async function ensureIncidentStrategies(
  admin: SupabaseClient,
  company: OfficeCompany,
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const strategies = readStrategies(row);
  const targets = readTargetsInternal(row);
  const about = company.about ?? "";
  const targetsOk = targets.length === 4 && targetsPassValidation(targets, about);
  if (strategies.length === 3 && targetsOk) return row;
  const fallback = offlineIncident({
    companyName: company.name,
    companyAbout: about,
    recentTitles: [],
    industryLabel: industryLabelJa(company.industry),
  });
  const nextStrategies = strategies.length === 3 ? strategies : fallback.strategies;
  const nextTargets = targetsOk ? targets : fallback.targets;
  const { data, error } = await admin
    .from("office_incidents")
    .update({ strategies: nextStrategies, targets: nextTargets })
    .eq("id", String(row.id))
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "strategy backfill failed");
  return data as Record<string, unknown>;
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
  if (!company.about) throw new Error("先に会社の説明を書いてね");

  const { data: open } = await admin
    .from("office_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (open) {
    let row = open as Record<string, unknown>;
    const mapped = mapIncident(row);
    if (!isMangledOfflineDescription(mapped.description)) {
      row = await ensureIncidentStrategies(admin, company, row);
      return { incident: mapIncident(row), created: false };
    }
    await admin.from("office_incidents").delete().eq("id", mapped.id);
  }

  const { data: recentRows } = await admin
    .from("office_incidents")
    .select("title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  const recentTitles = (recentRows ?? []).map((r) => String((r as { title: string }).title));

  const theme = seasonThemeFor();
  const castSummary = company.cast.map((c) => `${c.role}:${c.name}`).join(" / ");
  let followup: { title: string; strategyTitle: string; storyTone: string; id: string } | null =
    null;
  if (Math.random() < 0.2) {
    const { data: recentSubs } = await admin
      .from("office_submissions")
      .select("incident_id, strategy_title, story_tone")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);
    const pick = (recentSubs ?? [])[Math.floor(Math.random() * (recentSubs?.length || 1))];
    if (pick) {
      const { data: prevInc } = await admin
        .from("office_incidents")
        .select("id, title")
        .eq("id", String((pick as { incident_id: string }).incident_id))
        .maybeSingle();
      if (prevInc) {
        followup = {
          id: String((prevInc as { id: string }).id),
          title: String((prevInc as { title: string }).title),
          strategyTitle: String((pick as { strategy_title?: string }).strategy_title ?? "作戦"),
          storyTone: String((pick as { story_tone?: string }).story_tone ?? "ok"),
        };
      }
    }
  }

  const gen = await generateIncidentWithClaude({
    companyName: company.name,
    companyAbout: company.about,
    recentTitles,
    industryLabel: industryLabelJa(company.industry),
    castSummary,
    lowestMeter: lowestMeterKey(company.meters),
    seasonTheme: `${theme.labelJa}（${theme.promptHint}）`,
    followup: followup
      ? {
          title: followup.title,
          strategyTitle: followup.strategyTitle,
          storyTone: followup.storyTone,
        }
      : null,
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
      strategies: gen.strategies,
      targets: gen.targets,
      strategy_rerolls: 0,
      scene: gen.scene,
      speaker: { cast_role: gen.speaker.castRole, emotion: gen.speaker.emotion },
      line: gen.line,
      stakes: gen.stakes,
      meters_at_risk: gen.metersAtRisk,
      followup_of: followup?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "incident create failed");
  return { incident: mapIncident(data as Record<string, unknown>), created: true };
}

export async function dbRerollStrategies(admin: SupabaseClient, userId: string) {
  const { data: companyRow } = await admin
    .from("office_companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!companyRow) throw new Error("先に会社を作ってね");
  const company = mapCompany(companyRow as Record<string, unknown>);
  if (!company.about) throw new Error("先に会社の説明を書いてね");

  const { data: incidentRow } = await admin
    .from("office_incidents")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .maybeSingle();
  if (!incidentRow) throw new Error("事件がないよ");
  const row = incidentRow as Record<string, unknown>;
  const rerolls = Number(row.strategy_rerolls ?? 0);
  if (rerolls >= 1) throw new Error("引き直しは1回までだよ");

  const previous = readStrategies(row).map((s) => s.title);
  const gen = await regenerateStrategiesWithClaude({
    companyName: company.name,
    companyAbout: company.about,
    title: String(row.title),
    description: String(row.description),
    previousTitles: previous,
  });
  if (!gen.ok) throw new Error(gen.message);

  const { data, error } = await admin
    .from("office_incidents")
    .update({ strategies: gen.strategies, strategy_rerolls: 1 })
    .eq("id", String(row.id))
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "reroll failed");
  return mapIncident(data as Record<string, unknown>);
}

export async function dbSubmit(admin: SupabaseClient, userId: string, input: OfficeSubmitInput) {
  const text = input.answer.trim();
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
  let row = await ensureIncidentStrategies(
    admin,
    company,
    incidentRow as Record<string, unknown>,
  );
  const incident = mapIncident(row);
  const strategies = readStrategies(row);
  const targetsInternal = readTargetsInternal(row);

  const strategyId = String(input.strategyId ?? "").trim();
  if (!strategyId) throw new Error("作戦を選んでね");
  let strategyKind: StrategyKind = "custom";
  let strategyTitle = "自分の作戦";
  let strategySummary = "プレイヤー独自の作戦";
  if (strategyId === "custom") {
    strategyKind = "custom";
  } else {
    const found = strategies.find((s) => s.id === strategyId);
    if (!found) throw new Error("その作戦は選べないよ");
    strategyKind = found.kind;
    strategyTitle = found.title;
    strategySummary = found.summary;
  }

  const targetIds = Array.from(
    new Set((input.targetIds ?? []).map((x) => String(x).trim()).filter(Boolean)),
  ).slice(0, 2);
  if (targetIds.length < 1) throw new Error("ターゲットを選んでね");
  const hasOther = targetIds.includes("other");
  const otherText = String(input.targetOtherText ?? "").trim();
  if (hasOther) {
    if (otherText.length < 1 || otherText.length > OFFICE_TARGET_OTHER_MAX) {
      throw new Error(`その他は1〜${OFFICE_TARGET_OTHER_MAX}文字で書いてね`);
    }
  }
  for (const tid of targetIds) {
    if (tid === "other") continue;
    if (!targetsInternal.some((t) => t.id === tid)) {
      throw new Error("そのターゲットは選べないよ");
    }
  }

  const targetLabels = targetIds.map((tid) => {
    if (tid === "other") return otherText || "その他";
    return targetsInternal.find((t) => t.id === tid)?.label ?? tid;
  });

  const { data: consumeRows, error: consumeErr } = await admin.rpc("office_consume_stamina", {
    p_user_id: userId,
  });
  if (consumeErr) throw new Error(consumeErr.message);
  const consume = Array.isArray(consumeRows) ? consumeRows[0] : consumeRows;
  if (!consume?.ok) throw new Error("スタミナが足りないよ");

  const scored = await scoreAnswerWithClaude({
    companyName: company.name,
    industryLabel: industryLabelJa(company.industry),
    title: incident.title,
    description: incident.description,
    answer: text,
    strategyId,
    strategyKind,
    strategyTitle,
    strategySummary,
    targetLabels,
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
  const rev = calcRevenue({
    scoreTotal: scored.scores.total,
    size: incident.size,
    strategyKind,
    strategyId,
    wasSimilar,
    meters: company.meters,
  });
  const growth = applyRevenueGrowth(company.totalRevenue, rev.revenue);
  const season = await ensureSeasonRow(admin, userId, company.leagueId);

  const metersDelta = computeMetersDelta({
    scoreTotal: scored.scores.total,
    strategyKind,
    metersAtRisk: incident.metersAtRisk ?? [],
  });
  const nextMeters = applyMetersDelta(company.meters, metersDelta);
  const reaction = reactionForTone(scored.scores.storyTone);
  const speakerMember =
    company.cast.find((c) => c.role === incident.speaker?.castRole) ?? company.cast[0] ?? null;
  const panels = buildResultPanels({
    incidentTitle: incident.title,
    incidentLine: incident.line,
    incidentDescription: incident.description,
    strategyTitle,
    targetLabels,
    story: scored.scores.story,
    storyTone: scored.scores.storyTone,
    comment: scored.scores.comment,
  });

  const { error: incErr } = await admin
    .from("office_incidents")
    .update({ status: "solved" })
    .eq("id", incident.id)
    .eq("user_id", userId);
  if (incErr) {
    await admin.rpc("office_restore_stamina", { p_user_id: userId });
    throw new Error(incErr.message);
  }

  const baseSub = {
    user_id: userId,
    company_id: company.id,
    incident_id: incident.id,
    answer: text,
    strategy_id: strategyId,
    strategy_kind: strategyKind,
    target_ids: targetIds,
    target_other_text: hasOther ? otherText : null,
    score_solve: scored.scores.solve,
    score_fun: scored.scores.fun,
    score_feasible: scored.scores.feasible,
    score_fit: scored.scores.fit,
    score_total: scored.scores.total,
    comment: scored.scores.comment,
    story: scored.scores.story,
    story_tone: scored.scores.storyTone,
    next_hint: scored.scores.nextHint,
    multiplier: rev.multiplier,
    is_original: rev.isOriginal,
    revenue: rev.revenue,
    was_similar: wasSimilar,
    season_key: season.seasonKey,
  };
  const stageSub = {
    cast_member_id: speakerMember?.id ?? null,
    strategy_title: strategyTitle,
    panels,
    npc_line: reaction.line,
    reaction_emotion: reaction.emotion,
    meters_delta: metersDelta,
    safe: true,
  };

  let subRow: Record<string, unknown> | null = null;
  {
    const first = await admin
      .from("office_submissions")
      .insert({ ...baseSub, ...stageSub })
      .select("*")
      .single();
    if (!first.error && first.data) {
      subRow = first.data as Record<string, unknown>;
    } else {
      // SQL未適用時は旧カラムのみでフォールバック
      const second = await admin.from("office_submissions").insert(baseSub).select("*").single();
      if (second.error || !second.data) {
        await admin.rpc("office_restore_stamina", { p_user_id: userId });
        await admin.from("office_incidents").update({ status: "open" }).eq("id", incident.id);
        throw new Error(second.error?.message ?? first.error?.message ?? "submit failed");
      }
      subRow = second.data as Record<string, unknown>;
    }
  }

  const metersNow = new Date().toISOString();
  const companyPatch: Record<string, unknown> = {
    total_revenue: growth.totalRevenue,
    level: growth.level,
  };
  const metersPatch = await admin
    .from("office_companies")
    .update({
      ...companyPatch,
      meters: nextMeters,
      meters_updated_at: metersNow,
    })
    .eq("user_id", userId);
  if (metersPatch.error) {
    await admin.from("office_companies").update(companyPatch).eq("user_id", userId);
  }

  await admin
    .from("office_season_scores")
    .update({
      revenue: season.revenue + rev.revenue,
      league_id: company.leagueId,
    })
    .eq("id", season.id);

  const refreshed = await dbGetCompany(admin, userId);
  const submission = mapSubmission(subRow);
  if (!submission.panels) submission.panels = panels;
  if (!submission.strategyTitle) submission.strategyTitle = strategyTitle;
  if (!submission.npcLine) submission.npcLine = reaction.line;
  if (!submission.reactionEmotion) submission.reactionEmotion = reaction.emotion;
  if (!submission.metersDelta) submission.metersDelta = metersDelta;
  if (!submission.castMemberId && speakerMember) submission.castMemberId = speakerMember.id;
  return {
    submission,
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

export async function dbMarkSecretaryGuideDone(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("office_companies")
    .update({ secretary_guide_done: true })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "guide update failed");
  return mapCompany(data as Record<string, unknown>);
}
