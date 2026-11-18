import type { CardDef, CardEffect } from "@/lib/office/build/content/cards";
import type { ComboDef } from "@/lib/office/build/content/combos";
import type { EmployeeDef, EmployeePassive } from "@/lib/office/build/content/employees";
import type { OfficeMood } from "@/lib/office/build/mood";

export type TriggerLogEntry = {
  order: number;
  kind: "card" | "tag_boost" | "combo" | "hypothesis" | "adlib" | "employee";
  id: string;
  label: string;
  customersDelta?: number;
  priceDelta?: number;
  multFactor?: number;
};

export type ScoreInput = {
  baseCustomers: number;
  basePrice: number;
  norma: number;
  weakTags: string[];
  /** 場に出したカード（マスタ） */
  played: CardDef[];
  /** 手札（検証用） */
  handIds: string[];
  /** 予算（通常3。社員パッシブで減り得る） */
  budget?: number;
  combos: ComboDef[];
  employees?: EmployeeDef[];
  /** 仮説的中なら 1.3、外れ/未選択は 1.0 */
  hypothesisMult: number;
  adlibMult: number;
  /** 営業開始時の調子（立て直しボーナス判定） */
  moodBefore: OfficeMood;
};

export type ScoreResult = {
  customers: number;
  price: number;
  mult: number;
  revenue: number;
  ratio: number;
  rank: "S" | "A" | "B" | "C";
  coins: number;
  totalCost: number;
  budget: number;
  triggerLog: TriggerLogEntry[];
  comboIds: string[];
};

export class ScoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreValidationError";
  }
}

function tagBoostFactor(passives: EmployeePassive[], tag: string): number {
  let f = 1;
  for (const p of passives) {
    if (p.type === "tag_boost" && p.tag === tag) f *= p.factor;
  }
  return f;
}

function costReduce(passives: EmployeePassive[]): number {
  let n = 0;
  for (const p of passives) {
    if (p.type === "cost_reduce") n += p.amount;
  }
  return n;
}

function multBonus(passives: EmployeePassive[]): number {
  let n = 0;
  for (const p of passives) {
    if (p.type === "mult_bonus") n += p.amount;
  }
  return n;
}

function applyCardEffect(
  effect: CardEffect,
  weakMatch: boolean,
  tagFactors: number[],
): { customers: number; price: number; mult: number } {
  let customers = effect.customers ?? 0;
  let price = effect.price ?? 0;
  let mult = effect.mult ?? 1;
  if (weakMatch) {
    customers *= 1.2;
    price *= 1.2;
  }
  for (const f of tagFactors) {
    customers *= f;
    price *= f;
  }
  return { customers, price, mult };
}

function comboMatches(combo: ComboDef, played: CardDef[]): boolean {
  const match = combo.match;
  if ("card_ids" in match) {
    const ids = new Set(played.map((c) => c.id));
    return match.card_ids.every((id) => ids.has(id));
  }
  if ("tags" in match) {
    const tagSet = new Set(played.flatMap((c) => c.tags));
    return match.tags.every((t) => tagSet.has(t));
  }
  return false;
}

export function rankFromRatio(ratio: number): "S" | "A" | "B" | "C" {
  if (ratio >= 1.4) return "S";
  if (ratio >= 1.1) return "A";
  if (ratio >= 1.0) return "B";
  return "C";
}

export function calcCoins(revenue: number, ratio: number, moodBefore: OfficeMood): number {
  let coins = Math.floor(revenue / 100);
  if (ratio < 1.0) coins = Math.floor(coins * 0.5);
  if (moodBefore === "crisis" && ratio >= 1.0) coins = Math.floor(coins * 1.2);
  return Math.max(0, coins);
}

/** 得点計算の純粋関数（クライアント preview / サーバー確定で共有） */
export function scoreRun(input: ScoreInput): ScoreResult {
  const handSet = new Set(input.handIds);
  if (input.played.length > 3) {
    throw new ScoreValidationError("場に出せるカードは最大3枚だよ");
  }
  const seen = new Set<string>();
  for (const c of input.played) {
    if (!handSet.has(c.id)) {
      throw new ScoreValidationError("手札にないカードは出せないよ");
    }
    if (seen.has(c.id)) {
      throw new ScoreValidationError("同じカードを二重に出せないよ");
    }
    seen.add(c.id);
  }

  const passives = (input.employees ?? []).map((e) => e.passive);
  const baseBudget = input.budget ?? 3;
  const budget = Math.max(0, baseBudget - costReduce(passives));
  const totalCost = input.played.reduce((s, c) => s + c.cost, 0);
  if (totalCost > budget) {
    throw new ScoreValidationError(`予算オーバーだよ（${totalCost}/${budget}）`);
  }

  const weak = new Set(input.weakTags);
  const log: TriggerLogEntry[] = [];
  let order = 1;
  let customers = input.baseCustomers;
  let price = input.basePrice;
  let mult = 1;

  for (const card of input.played) {
    const weakMatch = card.tags.some((t) => weak.has(t));
    const tagFactors = card.tags.map((t) => tagBoostFactor(passives, t)).filter((f) => f !== 1);
    // タグブーストは掛け算で一度だけ（ユニーク）
    const uniqueFactor = tagFactors.length
      ? tagFactors.reduce((a, b) => a * b, 1)
      : 1;
    const applied = applyCardEffect(card.effect, weakMatch, uniqueFactor !== 1 ? [uniqueFactor] : []);

    customers += applied.customers;
    price += applied.price;
    mult *= applied.mult;

    log.push({
      order: order++,
      kind: "card",
      id: card.id,
      label: card.name,
      customersDelta: applied.customers || undefined,
      priceDelta: applied.price || undefined,
      multFactor: applied.mult !== 1 ? applied.mult : undefined,
    });
    if (weakMatch) {
      log.push({
        order: order++,
        kind: "tag_boost",
        id: card.id,
        label: `${card.name}（弱点一致×1.2）`,
      });
    }
  }

  const empMult = 1 + multBonus(passives);
  if (empMult !== 1) {
    mult *= empMult;
    log.push({
      order: order++,
      kind: "employee",
      id: "passive_mult",
      label: "社員パッシブ",
      multFactor: empMult,
    });
  }

  const comboIds: string[] = [];
  for (const combo of input.combos) {
    if (!comboMatches(combo, input.played)) continue;
    comboIds.push(combo.id);
    mult *= combo.bonusMult;
    log.push({
      order: order++,
      kind: "combo",
      id: combo.id,
      label: combo.name,
      multFactor: combo.bonusMult,
    });
  }

  const hyp = input.hypothesisMult > 0 ? input.hypothesisMult : 1;
  const adlib = input.adlibMult > 0 ? input.adlibMult : 1;
  if (hyp !== 1) {
    log.push({
      order: order++,
      kind: "hypothesis",
      id: "hypothesis",
      label: "仮説的中",
      multFactor: hyp,
    });
  }
  if (adlib !== 1) {
    log.push({
      order: order++,
      kind: "adlib",
      id: "adlib",
      label: "アドリブ",
      multFactor: adlib,
    });
  }

  // 負の客数・単価は下限1
  customers = Math.max(1, Math.round(customers));
  price = Math.max(1, Math.round(price));
  // mult = カード×コンボ×社員（仮説・アドリブは別掛け）
  const revenue = Math.round(customers * price * mult * hyp * adlib);
  const ratio = input.norma > 0 ? revenue / input.norma : 0;
  const rank = rankFromRatio(ratio);
  const coins = calcCoins(revenue, ratio, input.moodBefore);

  return {
    customers,
    price,
    mult: Number(mult.toFixed(6)),
    revenue,
    ratio: Number(ratio.toFixed(6)),
    rank,
    coins,
    totalCost,
    budget,
    triggerLog: log,
    comboIds,
  };
}
