import {
  OFFICE_NAME_MAX,
  OFFICE_SIMILARITY_THRESHOLD,
  OFFICE_TARGET_OTHER_MAX,
} from "@/lib/office/constants";
import { guessIndustryFromAbout, parseCompanyAbout } from "@/lib/office/about";
import { ensureCompanyCast } from "@/lib/office/cast";
import { industryLabelJa, parseOfficeIndustry } from "@/lib/office/industries";
import {
  applyMeterDecay,
  applyMetersDelta,
  computeMetersDelta,
  defaultMeters,
  ensureMeters,
} from "@/lib/office/meters";
import {
  isMangledOfflineDescription,
  offlineIncident,
  offlineScores,
  offlineStrategies,
} from "@/lib/office/offline";
import { nextLoginStreak } from "@/lib/office/loginStreak";
import { buildResultPanels, reactionForTone } from "@/lib/office/resultPanels";
import { applyRevenueGrowth, calcRevenue } from "@/lib/office/revenue";
import { seasonKeyFor } from "@/lib/office/season";
import { isTooSimilar } from "@/lib/office/similarity";
import { pickIncidentSize } from "@/lib/office/sizePick";
import { computeStamina, consumeStamina } from "@/lib/office/stamina";
import { stripTargetFit } from "@/lib/office/strategy";
import { isValidTargetLabel } from "@/lib/office/targetValidate";
import { parseOfficeLeagueId } from "@/lib/office/tiers";
import type {
  OfficeCompany,
  OfficeIncident,
  OfficeSeasonScore,
  OfficeSubmission,
  OfficeSubmitInput,
  RankingRow,
  StrategyKind,
} from "@/lib/office/types";

const STORAGE_KEY = "moni.office.v1";

type Store = {
  company: OfficeCompany | null;
  incidents: OfficeIncident[];
  submissions: OfficeSubmission[];
  seasons: OfficeSeasonScore[];
};

function empty(): Store {
  return { company: null, incidents: [], submissions: [], seasons: [] };
}

function read(): Store {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Store) };
  } catch {
    return empty();
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function uid(): string {
  return crypto.randomUUID();
}

function ensureSeason(store: Store, userId: string, leagueId: OfficeCompany["leagueId"]): OfficeSeasonScore {
  const key = seasonKeyFor();
  let row = store.seasons.find((s) => s.userId === userId && s.seasonKey === key);
  if (!row) {
    row = {
      id: uid(),
      userId,
      seasonKey: key,
      leagueId,
      revenue: 0,
      rank: null,
      result: null,
      resultSeen: false,
      createdAt: new Date().toISOString(),
    };
    store.seasons.push(row);
  }
  return row;
}

export function localGetCompany(userId: string): {
  company: OfficeCompany | null;
  stamina: ReturnType<typeof computeStamina>;
  seasonRevenue: number;
  pendingResult: OfficeSeasonScore | null;
} {
  const store = read();
  const company = store.company?.userId === userId ? store.company : null;
  if (!company) {
    return {
      company: null,
      stamina: computeStamina(5, new Date()),
      seasonRevenue: 0,
      pendingResult: null,
    };
  }
  if (company.about === undefined) {
    company.about = null;
    write(store);
  }
  if (company.industry === undefined) {
    company.industry = null;
    write(store);
  } else if (company.industry) {
    const mapped = parseOfficeIndustry(company.industry);
    if (mapped && mapped !== company.industry) {
      company.industry = mapped;
      write(store);
    }
  }
  if (!company.industry && company.about) {
    company.industry = guessIndustryFromAbout(company.about);
    write(store);
  }
  if (!company.cast?.length) {
    company.cast = ensureCompanyCast(null, company.id);
    write(store);
  }
  if (!company.meters) {
    company.meters = defaultMeters();
    company.metersUpdatedAt = new Date().toISOString();
    write(store);
  } else {
    company.meters = applyMeterDecay(ensureMeters(company.meters), company.metersUpdatedAt);
  }
  if (company.name.length > OFFICE_NAME_MAX) {
    company.name = company.name.slice(0, OFFICE_NAME_MAX);
    write(store);
  }
  const streak = nextLoginStreak(company.loginStreak ?? 0, company.loginLastDate);
  if (streak.changed) {
    company.loginStreak = streak.streak;
    company.loginLastDate = streak.lastDate;
    write(store);
  }
  const stamina = computeStamina(company.stamina, new Date(company.staminaUpdatedAt));
  if (stamina.value !== company.stamina || stamina.updatedAt.toISOString() !== company.staminaUpdatedAt) {
    company.stamina = stamina.value;
    company.staminaUpdatedAt = stamina.updatedAt.toISOString();
    write(store);
  }
  const season = ensureSeason(store, userId, company.leagueId);
  write(store);
  const pendingResult =
    store.seasons.find((s) => s.userId === userId && s.result && !s.resultSeen) ?? null;
  return { company, stamina, seasonRevenue: season.revenue, pendingResult };
}

export function localMarkSecretaryGuideDone(userId: string): OfficeCompany {
  const store = read();
  if (!store.company || store.company.userId !== userId) throw new Error("会社がないよ");
  store.company.secretaryGuideDone = true;
  write(store);
  return store.company;
}

export function localCreateCompany(userId: string, name: string, aboutRaw: string): OfficeCompany {
  const store = read();
  const trimmed = name.trim().slice(0, OFFICE_NAME_MAX);
  if (trimmed.length < 1) throw new Error("会社名を入力してね");
  const about = parseCompanyAbout(aboutRaw);
  if (!about) throw new Error("会社の説明を書いてね");
  if (store.company?.userId === userId) throw new Error("すでに会社があるよ");
  const now = new Date().toISOString();
  const id = uid();
  const company: OfficeCompany = {
    id,
    userId,
    name: trimmed,
    about,
    industry: guessIndustryFromAbout(about),
    totalRevenue: 0,
    level: 1,
    rankingEnabled: true,
    stamina: 5,
    staminaUpdatedAt: now,
    leagueId: "rookie",
    createdAt: now,
    cast: ensureCompanyCast(null, id),
    meters: defaultMeters(),
    metersUpdatedAt: now,
    sfxMuted: true,
    secretaryGuideDone: false,
    shareOptOut: false,
    loginStreak: 0,
    loginLastDate: null,
  };
  store.company = company;
  ensureSeason(store, userId, "rookie");
  write(store);
  return company;
}

export function localSetAbout(userId: string, aboutRaw: string): OfficeCompany {
  const store = read();
  if (!store.company || store.company.userId !== userId) throw new Error("会社がないよ");
  const about = parseCompanyAbout(aboutRaw);
  if (!about) throw new Error("会社の説明を書いてね");
  if (store.company.about) throw new Error("説明はもう決め済みだよ");
  store.company.about = about;
  store.company.industry = store.company.industry ?? guessIndustryFromAbout(about);
  store.incidents = store.incidents.filter((i) => !(i.userId === userId && i.status === "open"));
  write(store);
  return store.company;
}

export async function localCurrentIncident(
  userId: string,
): Promise<{ incident: OfficeIncident; created: boolean }> {
  const store = read();
  const company = store.company;
  if (!company || company.userId !== userId) throw new Error("先に会社を作ってね");
  if (company.about === undefined) company.about = null;
  if (!company.about) throw new Error("先に会社の説明を書いてね");
  const open = store.incidents.find((i) => i.userId === userId && i.status === "open");
  if (open && !isMangledOfflineDescription(open.description)) {
    const about = company.about;
    const rawTargets = open.targets ?? [];
    const needStrategies = open.strategies?.length !== 3;
    const needTargets =
      rawTargets.length !== 4 ||
      rawTargets.some((t) => !isValidTargetLabel(t.label, about));
    if (needStrategies || needTargets) {
      const fb = offlineIncident({
        companyName: company.name,
        companyAbout: about,
        recentTitles: [],
      });
      open.strategies = needStrategies ? fb.strategies : open.strategies;
      open.targets = needTargets ? stripTargetFit(fb.targets) : open.targets;
      open.strategyRerolls = open.strategyRerolls ?? 0;
      write(store);
    }
    return {
      incident: {
        ...open,
        strategies: open.strategies ?? [],
        targets: (open.targets ?? []).map((t) => ({ id: t.id, label: t.label })),
        strategyRerolls: open.strategyRerolls ?? 0,
      },
      created: false,
    };
  }
  if (open) {
    store.incidents = store.incidents.filter((i) => i.id !== open.id);
  }

  const recentTitles = store.incidents
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((i) => i.title);

  const gen = offlineIncident({
    companyName: company.name,
    companyAbout: company.about,
    recentTitles,
    industryLabel: industryLabelJa(company.industry),
  });
  const incident: OfficeIncident = {
    id: uid(),
    userId,
    companyId: company.id,
    title: gen.title,
    description: gen.description,
    type: gen.type,
    size: pickIncidentSize(),
    status: "open",
    strategies: gen.strategies,
    targets: stripTargetFit(gen.targets),
    strategyRerolls: 0,
    createdAt: new Date().toISOString(),
    scene: gen.scene,
    speaker: gen.speaker,
    line: gen.line,
    stakes: gen.stakes,
    metersAtRisk: gen.metersAtRisk,
    followupOf: null,
  };
  store.incidents.push(incident);
  write(store);
  return { incident, created: true };
}

export function localRerollStrategies(userId: string): OfficeIncident {
  const store = read();
  const company = store.company;
  if (!company || company.userId !== userId) throw new Error("先に会社を作ってね");
  const incident = store.incidents.find((i) => i.userId === userId && i.status === "open");
  if (!incident) throw new Error("事件がないよ");
  if ((incident.strategyRerolls ?? 0) >= 1) throw new Error("引き直しは1回までだよ");
  incident.strategies = offlineStrategies();
  incident.strategyRerolls = 1;
  write(store);
  return incident;
}

export async function localSubmit(
  userId: string,
  input: OfficeSubmitInput,
): Promise<{
  submission: OfficeSubmission;
  company: OfficeCompany;
  seasonRevenue: number;
  stamina: ReturnType<typeof computeStamina>;
}> {
  const store = read();
  const company = store.company;
  if (!company || company.userId !== userId) throw new Error("先に会社を作ってね");
  const incident = store.incidents.find((i) => i.userId === userId && i.status === "open");
  if (!incident) throw new Error("事件がないよ");

  const text = input.answer.trim();
  if (text.length < 5 || text.length > 300) throw new Error("回答は5〜300文字だよ");

  const strategyId = String(input.strategyId ?? "").trim();
  if (!strategyId) throw new Error("作戦を選んでね");
  let strategyKind: StrategyKind = "custom";
  let strategyTitle = "自分の作戦";
  if (strategyId === "custom") {
    strategyKind = "custom";
  } else {
    const found = incident.strategies.find((s) => s.id === strategyId);
    if (!found) throw new Error("その作戦は選べないよ");
    strategyKind = found.kind;
    strategyTitle = found.title;
  }

  const targetIds = Array.from(
    new Set((input.targetIds ?? []).map((x) => String(x).trim()).filter(Boolean)),
  ).slice(0, 2);
  if (targetIds.length < 1) throw new Error("ターゲットを選んでね");
  const hasOther = targetIds.includes("other");
  const otherText = String(input.targetOtherText ?? "").trim();
  if (hasOther && (otherText.length < 1 || otherText.length > OFFICE_TARGET_OTHER_MAX)) {
    throw new Error(`その他は1〜${OFFICE_TARGET_OTHER_MAX}文字で書いてね`);
  }
  const publicIds = new Set(incident.targets.map((t) => t.id));
  for (const tid of targetIds) {
    if (tid === "other") continue;
    if (!publicIds.has(tid)) throw new Error("そのターゲットは選べないよ");
  }

  const consumed = consumeStamina(company.stamina, new Date(company.staminaUpdatedAt));
  if (!consumed.ok) throw new Error("スタミナが足りないよ");
  company.stamina = consumed.state.value;
  company.staminaUpdatedAt = consumed.state.updatedAt.toISOString();
  write(store);

  const scores = offlineScores(text, { strategyKind, strategyTitle });

  const recent = store.submissions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((s) => s.answer);
  const wasSimilar = isTooSimilar(text, recent, OFFICE_SIMILARITY_THRESHOLD);
  const metersBefore = company.meters ?? defaultMeters();
  const rev = calcRevenue({
    scoreTotal: scores.total,
    size: incident.size,
    strategyKind,
    strategyId,
    wasSimilar,
    meters: metersBefore,
  });
  const growth = applyRevenueGrowth(company.totalRevenue, rev.revenue);
  company.totalRevenue = growth.totalRevenue;
  company.level = growth.level;

  const metersDelta = computeMetersDelta({
    scoreTotal: scores.total,
    strategyKind,
    metersAtRisk: incident.metersAtRisk ?? [],
  });
  company.meters = applyMetersDelta(metersBefore, metersDelta);
  company.metersUpdatedAt = new Date().toISOString();

  const targetLabels = targetIds.map((tid) => {
    if (tid === "other") return otherText || "その他";
    return incident.targets.find((t) => t.id === tid)?.label ?? tid;
  });
  const reaction = reactionForTone(scores.storyTone);
  const speakerMember =
    company.cast.find((c) => c.role === incident.speaker?.castRole) ?? company.cast[0] ?? null;
  const panels = buildResultPanels({
    incidentTitle: incident.title,
    incidentLine: incident.line,
    incidentDescription: incident.description,
    strategyTitle,
    targetLabels,
    story: scores.story,
    storyTone: scores.storyTone,
    comment: scores.comment,
  });

  incident.status = "solved";
  const season = ensureSeason(store, userId, company.leagueId);
  season.revenue += rev.revenue;
  season.leagueId = company.leagueId;

  const submission: OfficeSubmission = {
    id: uid(),
    userId,
    companyId: company.id,
    incidentId: incident.id,
    answer: text,
    strategyId,
    strategyKind,
    targetIds,
    targetOtherText: hasOther ? otherText : null,
    scoreSolve: scores.solve,
    scoreFun: scores.fun,
    scoreFeasible: scores.feasible,
    scoreFit: scores.fit,
    scoreTotal: scores.total,
    comment: scores.comment,
    story: scores.story,
    storyTone: scores.storyTone,
    nextHint: scores.nextHint,
    multiplier: rev.multiplier,
    isOriginal: rev.isOriginal,
    revenue: rev.revenue,
    wasSimilar,
    seasonKey: season.seasonKey,
    createdAt: new Date().toISOString(),
    panels,
    strategyTitle,
    castMemberId: speakerMember?.id ?? null,
    npcLine: reaction.line,
    reactionEmotion: reaction.emotion,
    metersDelta,
    safe: true,
  };
  store.submissions.push(submission);
  write(store);

  return {
    submission,
    company,
    seasonRevenue: season.revenue,
    stamina: computeStamina(company.stamina, new Date(company.staminaUpdatedAt)),
  };
}

export function localToggleRanking(userId: string, enabled: boolean): OfficeCompany {
  const store = read();
  if (!store.company || store.company.userId !== userId) throw new Error("会社がないよ");
  store.company.rankingEnabled = enabled;
  write(store);
  return store.company;
}

export function localRanking(userId: string): {
  seasonKey: string;
  leagueId: string;
  rows: RankingRow[];
  myRank: number | null;
  rankingEnabled: boolean;
} {
  const store = read();
  const company = store.company;
  const seasonKey = seasonKeyFor();
  const leagueId = company?.leagueId ?? "rookie";
  const season = store.seasons.find((s) => s.userId === userId && s.seasonKey === seasonKey);
  const meRevenue = season?.revenue ?? 0;
  // ローカルは自分だけ＋ダミー
  const bots: RankingRow[] = [
    { rank: 0, companyName: "放課後ラボ", revenue: Math.max(0, meRevenue + 400), userId: "bot-a" },
    { rank: 0, companyName: "文化祭商事", revenue: Math.max(0, meRevenue - 100), userId: "bot-b" },
    { rank: 0, companyName: "ねむねむ商店", revenue: Math.max(0, meRevenue - 350), userId: "bot-c" },
  ];
  const rows: RankingRow[] = [
    ...bots,
    {
      rank: 0,
      companyName: company?.name ?? "あなた",
      revenue: meRevenue,
      userId,
      isMe: true,
    },
  ]
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const myRank = rows.find((r) => r.userId === userId)?.rank ?? null;
  return {
    seasonKey,
    leagueId: parseOfficeLeagueId(leagueId),
    rows,
    myRank,
    rankingEnabled: company?.rankingEnabled ?? true,
  };
}

export function localMarkResultSeen(userId: string, seasonKey: string) {
  const store = read();
  const row = store.seasons.find((s) => s.userId === userId && s.seasonKey === seasonKey);
  if (row) {
    row.resultSeen = true;
    write(store);
  }
}
