import { SLOTS, emptyAssignments } from "./schedule";
import type { AssignResult, Assignments, Member, SlotId } from "./types";

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** 決定的な軽い乱数（同じ入力なら同じ並びになりやすい） */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countLoads(assignments: Assignments, memberIds: string[]): Map<string, number> {
  const loads = new Map(memberIds.map((id) => [id, 0]));
  for (const ids of Object.values(assignments)) {
    for (const id of ids) {
      loads.set(id, (loads.get(id) ?? 0) + 1);
    }
  }
  return loads;
}

/**
 * NG時間帯を避けつつ各コマを必要人数で埋める。
 * 候補が少ないコマから埋め、負担（担当コマ数）が少ない人を優先する。
 */
export function autoAssign(members: Member[], seed = Date.now()): AssignResult {
  const assignments = emptyAssignments();
  const warnings: AssignResult["warnings"] = [];
  const rng = mulberry32(seed >>> 0);
  const memberIds = members.map((m) => m.id);
  const byId = new Map(members.map((m) => [m.id, m]));

  const availableCount = (slotId: SlotId) =>
    members.filter((m) => !m.ngSlotIds.includes(slotId)).length;

  const orderedSlots = [...SLOTS].sort((a, b) => {
    const da = availableCount(a.id) - a.needed;
    const db = availableCount(b.id) - b.needed;
    if (da !== db) return da - db;
    return SLOTS.indexOf(a) - SLOTS.indexOf(b);
  });

  for (const slot of orderedSlots) {
    const candidates = members.filter((m) => !m.ngSlotIds.includes(slot.id));
    const loads = countLoads(assignments, memberIds);

    const ranked = [...candidates].sort((a, b) => {
      const la = loads.get(a.id) ?? 0;
      const lb = loads.get(b.id) ?? 0;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name, "ja");
    });

    // 同負担帯だけ軽くシャッフルして偏りを減らす
    const picked: string[] = [];
    let i = 0;
    while (picked.length < slot.needed && i < ranked.length) {
      const load = loads.get(ranked[i].id) ?? 0;
      let j = i;
      while (j < ranked.length && (loads.get(ranked[j].id) ?? 0) === load) j++;
      const band = ranked.slice(i, j);
      shuffleInPlace(band, rng);
      for (const m of band) {
        if (picked.length >= slot.needed) break;
        picked.push(m.id);
      }
      i = j;
    }

    assignments[slot.id] = picked;

    if (picked.length < slot.needed) {
      warnings.push({
        slotId: slot.id,
        shortfall: slot.needed - picked.length,
        message: `${slot.dayLabel} ${slot.start}–${slot.end} は参加可能が ${picked.length}人で、あと ${slot.needed - picked.length}人不足しています`,
      });
    }
  }

  // 名前で安定ソート
  for (const slot of SLOTS) {
    assignments[slot.id] = [...assignments[slot.id]].sort((a, b) => {
      const na = byId.get(a)?.name ?? "";
      const nb = byId.get(b)?.name ?? "";
      return na.localeCompare(nb, "ja");
    });
  }

  return { assignments, warnings };
}

export function loadStats(members: Member[], assignments: Assignments) {
  return members
    .map((m) => {
      let count = 0;
      for (const ids of Object.values(assignments)) {
        if (ids.includes(m.id)) count += 1;
      }
      return { member: m, count };
    })
    .sort((a, b) => b.count - a.count || a.member.name.localeCompare(b.member.name, "ja"));
}
