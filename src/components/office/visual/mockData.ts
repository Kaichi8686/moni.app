/** 見た目モック用の固定仮データ（本番ロジックではない） */

export type MockCard = {
  id: string;
  name: string;
  cost: number;
  text: string;
  customers: number;
  price: number;
  mult: number;
};

export type MockHypothesis = { id: string; text: string; correct: boolean };

export const MOCK_DATE_KEY = "2026-11-18";
export const MOCK_COINS = 1280;
export const MOCK_STAMINA = 4;

export const MOCK_EVENT = {
  title: "行列が止まらない！",
  norma: 80_000,
  baseCustomers: 100,
  basePrice: 500,
  chips: [
    { id: "d1", label: "待ち時間", value: "平均18分" },
    { id: "d2", label: "離脱率", value: "列の25%が帰る" },
    { id: "d3", label: "学生比率", value: "来客の4割" },
  ],
  hypotheses: [
    { id: "h1", text: "待ちが長くて客が逃げている", correct: true },
    { id: "h2", text: "味の評価が急に落ちた", correct: false },
    { id: "h3", text: "値段が高すぎて敬遠されている", correct: false },
  ] as MockHypothesis[],
};

export const MOCK_HAND: MockCard[] = [
  {
    id: "c1",
    name: "整理券",
    cost: 1,
    text: "客数 +20",
    customers: 20,
    price: 0,
    mult: 1,
  },
  {
    id: "c2",
    name: "学割",
    cost: 1,
    text: "客数 +30",
    customers: 30,
    price: 0,
    mult: 1,
  },
  {
    id: "c3",
    name: "セット割",
    cost: 1,
    text: "単価 +100",
    customers: 0,
    price: 100,
    mult: 1,
  },
  {
    id: "c4",
    name: "朝礼ショート",
    cost: 1,
    text: "倍率 ×1.1",
    customers: 0,
    price: 0,
    mult: 1.1,
  },
];

export const MOCK_TERM = {
  name: "回転率",
  shortDesc: "同じ席・時間で何組回せるか。待ちを減らすと客数が伸びる。",
  formula: "売上 = 客数 × 客単価 × 倍率",
};

export const MOCK_SHOP = {
  cards: [
    { id: "s1", name: "口コミお願い", price: 200, blurb: "客数 +40" },
    { id: "s2", name: "限定ポスター", price: 200, blurb: "客数 +25" },
  ],
  employee: { id: "e1", name: "笑顔の受付", price: 450, blurb: "接客タグ強化" },
};

export type MockScore = {
  customers: number;
  price: number;
  mult: number;
  revenue: number;
  ratio: number;
  rank: "S" | "A" | "B" | "C";
  coins: number;
  hypothesisHit: boolean;
  log: string[];
};

/** フロント簡易計算（本番 scoreRun とは別） */
export function calcMockScore(
  selectedIds: string[],
  hypothesisId: string | null,
): MockScore {
  const cards = MOCK_HAND.filter((c) => selectedIds.includes(c.id));
  let customers = MOCK_EVENT.baseCustomers;
  let price = MOCK_EVENT.basePrice;
  let mult = 1;
  const log: string[] = ["基本 客100 × 単価500"];

  for (const c of cards) {
    customers += c.customers;
    price += c.price;
    mult *= c.mult;
    const bits: string[] = [];
    if (c.customers) bits.push(`客${c.customers > 0 ? "+" : ""}${c.customers}`);
    if (c.price) bits.push(`単価${c.price > 0 ? "+" : ""}${c.price}`);
    if (c.mult !== 1) bits.push(`×${c.mult}`);
    log.push(`${c.name}（${bits.join(" ")}）`);
  }

  const hit = Boolean(
    hypothesisId && MOCK_EVENT.hypotheses.find((h) => h.id === hypothesisId)?.correct,
  );
  const hyp = hit ? 1.3 : 1.0;
  if (hit) log.push("仮説的中 ×1.3");

  const revenue = Math.round(customers * price * mult * hyp);
  const ratio = revenue / MOCK_EVENT.norma;
  const rank = ratio >= 1.4 ? "S" : ratio >= 1.1 ? "A" : ratio >= 1.0 ? "B" : "C";
  const coins = Math.floor(revenue / 100);

  return {
    customers,
    price,
    mult: Number((mult * hyp).toFixed(3)),
    revenue,
    ratio,
    rank,
    coins,
    hypothesisHit: hit,
    log,
  };
}
