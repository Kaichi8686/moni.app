/**
 * コンテンツバランス検証：各事件についてランダム手をシミュレートし、
 * 中央値 ratio と最善 ratio の帯を警告する。
 *
 * 実行: npx tsx src/lib/office/build/simulate.ts
 */
import { OFFICE_CARDS, STARTER_CARD_IDS, cardById } from "@/lib/office/build/content/cards";
import { OFFICE_COMBOS } from "@/lib/office/build/content/combos";
import { OFFICE_EVENTS } from "@/lib/office/build/content/events";
import { scoreRun } from "@/lib/office/build/score";

const TRIALS = 10_000;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickHand(rand: () => number, pool: string[], n: number): string[] {
  const copy = [...pool];
  const out: string[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const j = Math.floor(rand() * copy.length);
    out.push(copy.splice(j, 1)[0]!);
  }
  return out;
}

function allPlays(handIds: string[]) {
  const cards = handIds.map((id) => cardById(id)!).filter(Boolean);
  const plays: typeof cards[] = [[]];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        plays.push([cards[i]!, cards[j]!, cards[k]!]);
      }
      plays.push([cards[i]!, cards[j]!]);
    }
    plays.push([cards[i]!]);
  }
  return plays;
}

function median(nums: number[]): number {
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

export function simulateEvent(eventId: string, trials = TRIALS) {
  const event = OFFICE_EVENTS.find((e) => e.id === eventId);
  if (!event) throw new Error(`unknown event ${eventId}`);
  const pool = STARTER_CARD_IDS.length ? STARTER_CARD_IDS : OFFICE_CARDS.map((c) => c.id);
  const rand = mulberry32(
    [...eventId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 1),
  );
  const ratios: number[] = [];
  let best = 0;

  for (let t = 0; t < trials; t++) {
    const hand = pickHand(rand, pool, 5);
    const plays = allPlays(hand);
    // ランダム1手
    const candidates = plays.filter((p) => {
      try {
        scoreRun({
          baseCustomers: event.baseCustomers,
          basePrice: event.basePrice,
          norma: event.norma,
          weakTags: event.weakTags,
          played: p,
          handIds: hand,
          combos: OFFICE_COMBOS,
          hypothesisMult: 1.0,
          adlibMult: 1.0,
          moodBefore: "good",
        });
        return true;
      } catch {
        return false;
      }
    });
    if (!candidates.length) continue;
    const pick = candidates[Math.floor(rand() * candidates.length)]!;
    const hyp = rand() < 0.33 ? 1.3 : 1.0;
    const r = scoreRun({
      baseCustomers: event.baseCustomers,
      basePrice: event.basePrice,
      norma: event.norma,
      weakTags: event.weakTags,
      played: pick,
      handIds: hand,
      combos: OFFICE_COMBOS,
      hypothesisMult: hyp,
      adlibMult: 1.0,
      moodBefore: "good",
    });
    ratios.push(r.ratio);

    for (const p of candidates) {
      const bestR = scoreRun({
        baseCustomers: event.baseCustomers,
        basePrice: event.basePrice,
        norma: event.norma,
        weakTags: event.weakTags,
        played: p,
        handIds: hand,
        combos: OFFICE_COMBOS,
        hypothesisMult: 1.3,
        adlibMult: 1.0,
        moodBefore: "good",
      });
      if (bestR.ratio > best) best = bestR.ratio;
    }
  }

  const med = ratios.length ? median(ratios) : 0;
  return { eventId, title: event.title, trials: ratios.length, medianRatio: med, bestRatio: best };
}

export function simulateAll(trials = TRIALS) {
  const warnings: string[] = [];
  const rows = OFFICE_EVENTS.map((e) => {
    const row = simulateEvent(e.id, trials);
    if (row.medianRatio < 0.7 || row.medianRatio > 1.1) {
      warnings.push(
        `[median] ${row.eventId} ${row.title}: median=${row.medianRatio.toFixed(3)} (want 0.7–1.1)`,
      );
    }
    if (row.bestRatio < 1.3 || row.bestRatio > 2.0) {
      warnings.push(
        `[best] ${row.eventId} ${row.title}: best=${row.bestRatio.toFixed(3)} (want 1.3–2.0)`,
      );
    }
    return row;
  });
  return { rows, warnings };
}

const isMain = process.argv[1]?.includes("simulate");
if (isMain) {
  const trials = Number(process.env.SIM_TRIALS ?? TRIALS);
  const { rows, warnings } = simulateAll(trials);
  for (const r of rows) {
    console.log(
      `${r.eventId.padEnd(22)} median=${r.medianRatio.toFixed(3)} best=${r.bestRatio.toFixed(3)} n=${r.trials}`,
    );
  }
  if (warnings.length) {
    console.log("\nWARNINGS:");
    for (const w of warnings) console.log(" -", w);
    process.exitCode = 0; // 警告のみ（バランス調整の土台）
  } else {
    console.log("\nAll events within bands.");
  }
}
