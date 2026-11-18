import { OFFICE_CARDS, STARTER_CARD_IDS, type CardDef } from "@/lib/office/build/content/cards";
import { OFFICE_EVENTS, type EventDef } from "@/lib/office/build/content/events";
import { tokyoParts } from "@/lib/office/season";

const TOKYO = "Asia/Tokyo";

/** JST の営業日キー YYYY-MM-DD */
export function dateKeyFor(date: Date = new Date()): string {
  const p = tokyoParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndexed<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

/** デイリー：全員同じ事件・手札 */
export function pickDailyDeal(dateKey: string): { event: EventDef; hand: CardDef[] } {
  const rand = mulberry32(hashString(`daily:${dateKey}`));
  // 共通事件を優先
  const common = OFFICE_EVENTS.filter((e) => e.industry == null);
  const pool = common.length ? common : OFFICE_EVENTS;
  const event = pickIndexed(rand, pool);
  const starter = STARTER_CARD_IDS.map((id) => OFFICE_CARDS.find((c) => c.id === id)!).filter(
    Boolean,
  );
  const hand = dealHand(rand, starter, 5);
  return { event, hand };
}

/** フリー：業種優先で事件、デッキから手札 */
export function pickFreeDeal(
  industry: string | null | undefined,
  deckIds: string[],
  seedSalt: string,
): { event: EventDef; hand: CardDef[] } {
  const rand = mulberry32(hashString(`free:${seedSalt}`));
  const preferred = industry
    ? OFFICE_EVENTS.filter((e) => e.industry === industry)
    : [];
  const common = OFFICE_EVENTS.filter((e) => e.industry == null);
  const pool = preferred.length ? preferred : common.length ? common : OFFICE_EVENTS;
  const event = pickIndexed(rand, pool);
  const deckCards = deckIds
    .map((id) => OFFICE_CARDS.find((c) => c.id === id))
    .filter((c): c is CardDef => Boolean(c));
  const poolCards = deckCards.length >= 5 ? deckCards : STARTER_CARD_IDS.map((id) => OFFICE_CARDS.find((c) => c.id === id)!).filter(Boolean);
  const hand = dealHand(rand, poolCards, 5);
  return { event, hand };
}

function dealHand(rand: () => number, pool: CardDef[], n: number): CardDef[] {
  const copy = [...pool];
  const out: CardDef[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(rand() * copy.length);
    out.push(copy.splice(i, 1)[0]!);
  }
  // 不足時は全体から補充
  while (out.length < n) {
    out.push(pickIndexed(rand, OFFICE_CARDS));
  }
  return out;
}

export function msUntilNextTokyoMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") bag[p.type] = p.value;
  const y = Number(bag.year);
  const m = Number(bag.month);
  const d = Number(bag.day);
  // 翌日 0:00 JST = UTC 前日 15:00
  const nextUtc = Date.UTC(y, m - 1, d + 1, 15, 0, 0);
  // Wait - JST midnight is UTC 15:00 of previous calendar day in UTC terms.
  // If today is 2026-11-18 JST, next midnight is 2026-11-18 15:00 UTC (= 11-19 00:00 JST).
  // Using Date.UTC(y, m-1, d, 15, 0, 0) gives today 15:00 UTC = tomorrow 00:00 JST when JST date is y-m-d...
  // Actually for JST date y-m-d, that day's end (next midnight) is Date.UTC(y, m-1, d, 15, 0, 0).
  const end = Date.UTC(y, m - 1, d, 15, 0, 0);
  return Math.max(0, end - now.getTime());
}
