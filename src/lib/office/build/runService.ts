import { STARTER_CARD_IDS, cardById } from "@/lib/office/build/content/cards";
import { OFFICE_COMBOS } from "@/lib/office/build/content/combos";
import { OFFICE_EMPLOYEES } from "@/lib/office/build/content/employees";
import { eventById } from "@/lib/office/build/content/events";
import { OFFICE_TERMS } from "@/lib/office/build/content/terms";
import { dateKeyFor, pickDailyDeal, pickFreeDeal } from "@/lib/office/build/daily";
import { calcMood, type OfficeMood } from "@/lib/office/build/mood";
import {
  correctHypothesis,
  hypothesisMultFor,
  publicHand,
  toPublicEvent,
} from "@/lib/office/build/publicEvent";
import { scoreRun, ScoreValidationError } from "@/lib/office/build/score";
import type { BuildCompanyState, OfficeRun, RunMode } from "@/lib/office/build/runTypes";
import { levelFromTotalRevenue } from "@/lib/office/build/level";
import { consumeStamina, computeStamina } from "@/lib/office/stamina";

export class RunServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RunServiceError";
    this.status = status;
  }
}

export type RunStore = {
  getCompany(userId: string): BuildCompanyState | null;
  saveCompany(company: BuildCompanyState): void;
  getRun(runId: string): OfficeRun | null;
  findDailyRun(userId: string, dateKey: string): OfficeRun | null;
  saveRun(run: OfficeRun): void;
  listFinishedRatios(userId: string, limit: number): number[];
};

function uid(): string {
  return crypto.randomUUID();
}

function ensureLive(run: OfficeRun, now = new Date()): OfficeRun {
  if (run.status === "finished" || run.status === "expired") return run;
  if (new Date(run.expiresAt).getTime() <= now.getTime()) {
    return { ...run, status: "expired" };
  }
  return run;
}

function publicRun(run: OfficeRun) {
  return {
    id: run.id,
    mode: run.mode,
    dateKey: run.dateKey,
    status: run.status,
    expiresAt: run.expiresAt,
    hypothesisId: run.hypothesisId,
    moodBefore: run.moodBefore,
    event: toPublicEvent(run.event),
    hand: publicHand(run.hand),
  };
}

export function startRun(
  store: RunStore,
  userId: string,
  mode: RunMode,
  now = new Date(),
): { run: ReturnType<typeof publicRun>; company: BuildCompanyState; created: boolean } {
  const company = store.getCompany(userId);
  if (!company) throw new RunServiceError("会社を先につくってね", 404);

  const dateKey = dateKeyFor(now);

  if (mode === "daily") {
    const existing = store.findDailyRun(userId, dateKey);
    if (existing) {
      const live = ensureLive(existing, now);
      if (live.status === "finished") {
        throw new RunServiceError("今日のデイリーはもうクリア済みだよ", 409);
      }
      if (live.status === "expired") {
        store.saveRun(live);
        throw new RunServiceError("今日のデイリーは期限切れだよ", 409);
      }
      store.saveRun(live);
      return { run: publicRun(live), company, created: false };
    }
  }

  let nextCompany = { ...company };
  if (mode === "free") {
    const stamina = consumeStamina(
      company.stamina,
      new Date(company.staminaUpdatedAt),
      now,
    );
    if (!stamina.ok) throw new RunServiceError("スタミナが足りないよ", 400);
    nextCompany.stamina = stamina.state.value;
    nextCompany.staminaUpdatedAt = stamina.state.updatedAt.toISOString();
  }

  const deal =
    mode === "daily"
      ? pickDailyDeal(dateKey)
      : pickFreeDeal(company.industry, company.deckIds, `${userId}:${now.toISOString()}`);

  // 調子は開始時に再計算
  const ratios = store.listFinishedRatios(userId, 3);
  const mood = calcMood({ recentRatios: ratios, streak: company.streak });
  nextCompany.mood = mood;
  nextCompany.recentRatios = ratios;

  const run: OfficeRun = {
    id: uid(),
    userId,
    companyId: company.id,
    mode,
    dateKey,
    eventId: deal.event.id,
    event: deal.event,
    hand: deal.hand,
    hypothesisId: null,
    playedCardIds: null,
    adlibText: null,
    adlibMult: null,
    customers: null,
    price: null,
    mult: null,
    revenue: null,
    ratio: null,
    rank: null,
    coins: null,
    triggerLog: null,
    moodBefore: mood,
    moodAfter: null,
    status: "started",
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
    finishedAt: null,
  };

  store.saveCompany(nextCompany);
  store.saveRun(run);
  return { run: publicRun(run), company: nextCompany, created: true };
}

export function diagnoseRun(
  store: RunStore,
  userId: string,
  runId: string,
  hypothesisId: string,
  now = new Date(),
) {
  const run0 = store.getRun(runId);
  if (!run0 || run0.userId !== userId) throw new RunServiceError("営業日が見つからないよ", 404);
  const run = ensureLive(run0, now);
  if (run.status === "expired") {
    store.saveRun(run);
    throw new RunServiceError("この営業日は期限切れだよ", 410);
  }
  if (run.status === "finished") throw new RunServiceError("もう結果が出てるよ", 409);
  if (!run.event.hypotheses.some((h) => h.id === hypothesisId)) {
    throw new RunServiceError("仮説が不正だよ");
  }
  const next = { ...run, hypothesisId, status: "diagnosed" as const };
  store.saveRun(next);
  return { run: publicRun(next) };
}

export function previewRun(
  store: RunStore,
  userId: string,
  runId: string,
  playedCardIds: string[],
  now = new Date(),
) {
  const run0 = store.getRun(runId);
  if (!run0 || run0.userId !== userId) throw new RunServiceError("営業日が見つからないよ", 404);
  const run = ensureLive(run0, now);
  if (run.status === "expired") {
    store.saveRun(run);
    throw new RunServiceError("この営業日は期限切れだよ", 410);
  }
  if (run.status === "finished") throw new RunServiceError("もう結果が出てるよ", 409);

  const company = store.getCompany(userId);
  const employees = (company?.employeeIds ?? [])
    .map((id) => OFFICE_EMPLOYEES.find((e) => e.id === id))
    .filter(Boolean);

  const played = playedCardIds.map((id) => {
    const c = cardById(id);
    if (!c) throw new RunServiceError(`不明なカード: ${id}`);
    return c;
  });

  try {
    const scored = scoreRun({
      baseCustomers: run.event.baseCustomers,
      basePrice: run.event.basePrice,
      norma: run.event.norma,
      weakTags: run.event.weakTags,
      played,
      handIds: run.hand.map((c) => c.id),
      combos: OFFICE_COMBOS,
      employees: employees as typeof OFFICE_EMPLOYEES,
      hypothesisMult: hypothesisMultFor(run.event, run.hypothesisId),
      adlibMult: 1,
      moodBefore: run.moodBefore,
    });
    return {
      preview: {
        customers: scored.customers,
        price: scored.price,
        mult: scored.mult,
        revenue: scored.revenue,
        ratio: scored.ratio,
        rank: scored.rank,
        coins: scored.coins,
        totalCost: scored.totalCost,
        budget: scored.budget,
        comboHint: scored.comboIds.length
          ? "コンボの予感あり…"
          : null,
      },
    };
  } catch (e) {
    if (e instanceof ScoreValidationError) throw new RunServiceError(e.message);
    throw e;
  }
}

export type AdlibJudge = (input: {
  eventTitle: string;
  cards: string[];
  adlib: string;
}) => Promise<{ mult: number; comment: string; safe: boolean }>;

const defaultAdlib: AdlibJudge = async () => ({
  mult: 1,
  comment: "",
  safe: true,
});

export async function playRun(
  store: RunStore,
  userId: string,
  runId: string,
  playedCardIds: string[],
  adlibText: string | undefined,
  judge: AdlibJudge = defaultAdlib,
  now = new Date(),
) {
  const run0 = store.getRun(runId);
  if (!run0 || run0.userId !== userId) throw new RunServiceError("営業日が見つからないよ", 404);
  let run = ensureLive(run0, now);
  if (run.status === "expired") {
    store.saveRun(run);
    throw new RunServiceError("この営業日は期限切れだよ", 410);
  }
  if (run.status === "finished") {
    // 冪等：同じ結果を返す
    return finishPayload(store, run, store.getCompany(userId)!);
  }
  if (!run.hypothesisId) throw new RunServiceError("先に仮説を選んでね");

  const company = store.getCompany(userId);
  if (!company) throw new RunServiceError("会社がないよ", 404);

  const employees = company.employeeIds
    .map((id) => OFFICE_EMPLOYEES.find((e) => e.id === id))
    .filter(Boolean);

  const played = playedCardIds.map((id) => {
    const c = cardById(id);
    if (!c) throw new RunServiceError(`不明なカード: ${id}`);
    return c;
  });
  if (played.length < 1) throw new RunServiceError("カードを1枚以上出してね");

  let adlibMult = 1;
  let adlibComment = "";
  const trimmed = (adlibText ?? "").trim();
  if (trimmed) {
    if (trimmed.length > 40) throw new RunServiceError("アドリブは40字以内だよ");
    if (played.length < 1) throw new RunServiceError("アドリブにはカードが必要だよ");
    const judged = await judge({
      eventTitle: run.event.title,
      cards: played.map((c) => c.name),
      adlib: trimmed,
    });
    adlibMult = judged.mult;
    adlibComment = judged.comment;
  }

  let scored;
  try {
    scored = scoreRun({
      baseCustomers: run.event.baseCustomers,
      basePrice: run.event.basePrice,
      norma: run.event.norma,
      weakTags: run.event.weakTags,
      played,
      handIds: run.hand.map((c) => c.id),
      combos: OFFICE_COMBOS,
      employees: employees as typeof OFFICE_EMPLOYEES,
      hypothesisMult: hypothesisMultFor(run.event, run.hypothesisId),
      adlibMult,
      moodBefore: run.moodBefore,
    });
  } catch (e) {
    if (e instanceof ScoreValidationError) throw new RunServiceError(e.message);
    throw e;
  }

  const cleared = scored.ratio >= 1.0;
  const nextStreak = cleared ? company.streak + 1 : 0;
  const recent = [scored.ratio, ...company.recentRatios].slice(0, 3);
  const moodAfter = calcMood({ recentRatios: recent, streak: nextStreak });

  let nextCompany: BuildCompanyState = {
    ...company,
    coins: company.coins + scored.coins,
    streak: nextStreak,
    mood: moodAfter,
    recentRatios: recent,
    totalRevenue:
      run.mode === "daily"
        ? company.totalRevenue + scored.revenue
        : company.totalRevenue + scored.revenue,
    level: 1,
  };
  nextCompany.level = levelFromTotalRevenue(nextCompany.totalRevenue);

  // 用語解放（使ったカード・コンボ・コーチ）
  const unlockTermIds = new Set<string>(nextCompany.termIds);
  for (const c of played) {
    if (c.term) unlockTermIds.add(c.term);
  }
  for (const id of scored.comboIds) {
    const combo = OFFICE_COMBOS.find((x) => x.id === id);
    if (combo?.termId) unlockTermIds.add(combo.termId);
  }
  for (const tid of run.event.coach.termIds) unlockTermIds.add(tid);
  const newlyUnlocked = [...unlockTermIds].filter((id) => !company.termIds.includes(id));
  nextCompany.termIds = [...unlockTermIds];

  run = {
    ...run,
    playedCardIds,
    adlibText: trimmed || null,
    adlibMult,
    customers: scored.customers,
    price: scored.price,
    mult: scored.mult,
    revenue: scored.revenue,
    ratio: scored.ratio,
    rank: scored.rank,
    coins: scored.coins,
    triggerLog: scored.triggerLog,
    moodAfter,
    status: "finished",
    finishedAt: now.toISOString(),
  };

  store.saveCompany(nextCompany);
  store.saveRun(run);

  return {
    ...finishPayload(store, run, nextCompany),
    adlibComment,
    newlyUnlockedTerms: newlyUnlocked
      .map((id) => OFFICE_TERMS.find((t) => t.id === id))
      .filter(Boolean),
    correctHypothesis: correctHypothesis(run.event),
    coach: run.event.coach,
  };
}

function finishPayload(store: RunStore, run: OfficeRun, company: BuildCompanyState) {
  void store;
  return {
    run: {
      id: run.id,
      mode: run.mode,
      status: run.status,
      customers: run.customers,
      price: run.price,
      mult: run.mult,
      revenue: run.revenue,
      ratio: run.ratio,
      rank: run.rank,
      coins: run.coins,
      triggerLog: run.triggerLog,
      moodBefore: run.moodBefore,
      moodAfter: run.moodAfter,
      hypothesisId: run.hypothesisId,
    },
    company,
  };
}

export function getGameState(store: RunStore, userId: string, now = new Date()) {
  const company = store.getCompany(userId);
  if (!company) return { company: null as BuildCompanyState | null, daily: null };

  const stamina = computeStamina(company.stamina, new Date(company.staminaUpdatedAt), now);
  const dateKey = dateKeyFor(now);
  const daily = store.findDailyRun(userId, dateKey);
  const live = daily ? ensureLive(daily, now) : null;
  if (live && live !== daily) store.saveRun(live);

  return {
    company: {
      ...company,
      stamina: stamina.value,
      staminaUpdatedAt: stamina.updatedAt.toISOString(),
      nextRecoverAt: stamina.nextRecoverAt?.toISOString() ?? null,
      level: levelFromTotalRevenue(company.totalRevenue),
    },
    daily: live
      ? {
          status: live.status,
          revenue: live.revenue,
          rank: live.rank,
          runId: live.id,
        }
      : { status: "available" as const, revenue: null, rank: null, runId: null },
    dateKey,
  };
}

export function ensureStarterCompany(
  partial: Omit<BuildCompanyState, "deckIds" | "employeeIds" | "termIds" | "recentRatios"> & {
    deckIds?: string[];
    employeeIds?: string[];
    termIds?: string[];
    recentRatios?: number[];
  },
): BuildCompanyState {
  return {
    ...partial,
    deckIds: partial.deckIds?.length ? partial.deckIds : [...STARTER_CARD_IDS],
    employeeIds: partial.employeeIds ?? [],
    termIds: partial.termIds ?? ["customers", "revenue_eq", "norma", "hypothesis"],
    recentRatios: partial.recentRatios ?? [],
  };
}

export function buyShopItem(
  store: RunStore,
  userId: string,
  itemType: "card" | "employee",
  id: string,
) {
  const company = store.getCompany(userId);
  if (!company) throw new RunServiceError("会社がないよ", 404);

  if (itemType === "card") {
    const card = cardById(id);
    if (!card) throw new RunServiceError("カードがないよ");
    if (company.deckIds.includes(id)) throw new RunServiceError("もう持ってるよ");
    if (company.level < card.unlockLevel) throw new RunServiceError("レベルが足りないよ");
    const price = card.rarity === "epic" ? 800 : card.rarity === "rare" ? 400 : 200;
    if (company.coins < price) throw new RunServiceError("コインが足りないよ");
    const next = {
      ...company,
      coins: company.coins - price,
      deckIds: [...company.deckIds, id],
    };
    store.saveCompany(next);
    return { company: next, bought: { type: itemType, id, price } };
  }

  const emp = OFFICE_EMPLOYEES.find((e) => e.id === id);
  if (!emp) throw new RunServiceError("社員がいないよ");
  if (company.employeeIds.includes(id)) throw new RunServiceError("もう雇ってるよ");
  if (company.coins < emp.price) throw new RunServiceError("コインが足りないよ");
  const next = {
    ...company,
    coins: company.coins - emp.price,
    employeeIds: [...company.employeeIds, id],
  };
  store.saveCompany(next);
  return { company: next, bought: { type: itemType, id, price: emp.price } };
}

export { eventById };
