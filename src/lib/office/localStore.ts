import { OFFICE_NAME_MAX, OFFICE_SIMILARITY_THRESHOLD } from "@/lib/office/constants";
import { industryLabelJa, parseOfficeIndustry, type OfficeIndustry } from "@/lib/office/industries";
import { offlineIncident, offlineScores } from "@/lib/office/offline";
import { applyRevenueGrowth, calcRevenue } from "@/lib/office/revenue";
import { seasonKeyFor } from "@/lib/office/season";
import { isTooSimilar } from "@/lib/office/similarity";
import { pickIncidentSize } from "@/lib/office/sizePick";
import { computeStamina, consumeStamina } from "@/lib/office/stamina";
import { parseOfficeLeagueId } from "@/lib/office/tiers";
import type {
  OfficeCompany,
  OfficeIncident,
  OfficeSeasonScore,
  OfficeSubmission,
  RankingRow,
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
  if (company.name.length > OFFICE_NAME_MAX) {
    company.name = company.name.slice(0, OFFICE_NAME_MAX);
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

export function localCreateCompany(
  userId: string,
  name: string,
  industry: OfficeIndustry,
): OfficeCompany {
  const store = read();
  const trimmed = name.trim().slice(0, OFFICE_NAME_MAX);
  if (trimmed.length < 1) throw new Error("会社名を入力してね");
  if (!parseOfficeIndustry(industry)) throw new Error("系統を選んでね");
  if (store.company?.userId === userId) throw new Error("すでに会社があるよ");
  const now = new Date().toISOString();
  const company: OfficeCompany = {
    id: uid(),
    userId,
    name: trimmed,
    industry,
    totalRevenue: 0,
    level: 1,
    rankingEnabled: true,
    stamina: 5,
    staminaUpdatedAt: now,
    leagueId: "rookie",
    createdAt: now,
  };
  store.company = company;
  ensureSeason(store, userId, "rookie");
  write(store);
  return company;
}

export function localSetIndustry(userId: string, industry: OfficeIndustry): OfficeCompany {
  const store = read();
  if (!store.company || store.company.userId !== userId) throw new Error("会社がないよ");
  if (!parseOfficeIndustry(industry)) throw new Error("系統を選んでね");
  if (store.company.industry) throw new Error("系統はもう決め済みだよ");
  store.company.industry = industry;
  write(store);
  return store.company;
}

export async function localCurrentIncident(
  userId: string,
): Promise<{ incident: OfficeIncident; created: boolean }> {
  const store = read();
  const company = store.company;
  if (!company || company.userId !== userId) throw new Error("先に会社を作ってね");
  if (!company.industry) throw new Error("先に系統を選んでね");
  // migrate old local companies without industry field
  if (company.industry === undefined) company.industry = null;
  const open = store.incidents.find((i) => i.userId === userId && i.status === "open");
  if (open) return { incident: open, created: false };

  const recentTitles = store.incidents
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((i) => i.title);

  const gen = offlineIncident({
    companyName: company.name,
    industryLabel: industryLabelJa(company.industry),
    recentTitles,
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
    createdAt: new Date().toISOString(),
  };
  store.incidents.push(incident);
  write(store);
  return { incident, created: true };
}

export async function localSubmit(
  userId: string,
  answer: string,
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

  const text = answer.trim();
  if (text.length < 5 || text.length > 300) throw new Error("回答は5〜300文字だよ");

  const consumed = consumeStamina(company.stamina, new Date(company.staminaUpdatedAt));
  if (!consumed.ok) throw new Error("スタミナが足りないよ");
  company.stamina = consumed.state.value;
  company.staminaUpdatedAt = consumed.state.updatedAt.toISOString();
  write(store);

  const scores = offlineScores(text);

  const recent = store.submissions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((s) => s.answer);
  const wasSimilar = isTooSimilar(text, recent, OFFICE_SIMILARITY_THRESHOLD);
  const revenue = calcRevenue({
    scoreTotal: scores.total,
    size: incident.size,
    wasSimilar,
  });
  const growth = applyRevenueGrowth(company.totalRevenue, revenue);
  company.totalRevenue = growth.totalRevenue;
  company.level = growth.level;

  incident.status = "solved";
  const season = ensureSeason(store, userId, company.leagueId);
  season.revenue += revenue;
  season.leagueId = company.leagueId;

  const submission: OfficeSubmission = {
    id: uid(),
    userId,
    companyId: company.id,
    incidentId: incident.id,
    answer: text,
    scoreSolve: scores.solve,
    scoreFun: scores.fun,
    scoreFeasible: scores.feasible,
    scoreTotal: scores.total,
    comment: scores.comment,
    revenue,
    wasSimilar,
    seasonKey: season.seasonKey,
    createdAt: new Date().toISOString(),
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
