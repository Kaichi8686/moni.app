import { SLOTS, emptyAssignments, slotsForDay } from "./schedule";
import type { AssignResult, Assignments, DayId, Member, ShiftSlot, SlotId } from "./types";

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

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

function countDayLoads(
  assignments: Assignments,
  memberIds: string[],
): Record<DayId, Map<string, number>> {
  const d1 = new Map(memberIds.map((id) => [id, 0]));
  const d2 = new Map(memberIds.map((id) => [id, 0]));
  for (const slot of SLOTS) {
    const map = slot.dayId === "d1" ? d1 : d2;
    for (const id of assignments[slot.id]) {
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  }
  return { d1, d2 };
}

/** 同じ日の前後コマに既に入っているか（2連続禁止） */
export function hasAdjacentAssignment(
  assignments: Assignments,
  memberId: string,
  slot: ShiftSlot,
): boolean {
  const daySlots = slotsForDay(slot.dayId);
  const idx = daySlots.findIndex((s) => s.id === slot.id);
  if (idx < 0) return false;
  const prev = daySlots[idx - 1];
  const next = daySlots[idx + 1];
  if (prev && assignments[prev.id].includes(memberId)) return true;
  if (next && assignments[next.id].includes(memberId)) return true;
  return false;
}

function dayBalancePenalty(
  dayLoads: Record<DayId, Map<string, number>>,
  memberId: string,
  dayId: DayId,
): number {
  const thisDay = dayLoads[dayId].get(memberId) ?? 0;
  const otherDay = dayLoads[dayId === "d1" ? "d2" : "d1"].get(memberId) ?? 0;
  // この日を1増やすと差がどうなるか
  const afterAbs = Math.abs(thisDay + 1 - otherDay);
  const beforeAbs = Math.abs(thisDay - otherDay);
  // この日のコマ数が多い人は後回し、差が広がるのも後回し
  return thisDay * 1000 + afterAbs * 10 + (afterAbs > beforeAbs ? 5 : 0);
}

/**
 * NG時間帯を避け、2連続シフトを禁止しつつ各コマを必要人数で埋める。
 * 総負担と「1日目 / 2日目の回数差」が小さくなるよう優先する。
 * メンバー一覧自体は変更しない。
 */
export function autoAssign(members: Member[], seed = Date.now()): AssignResult {
  const assignments = emptyAssignments();
  const warnings: AssignResult["warnings"] = [];
  const rng = mulberry32(seed >>> 0);
  const memberIds = members.map((m) => m.id);
  const byId = new Map(members.map((m) => [m.id, m]));

  const availableCount = (slot: ShiftSlot) =>
    members.filter(
      (m) =>
        !m.ngSlotIds.includes(slot.id) &&
        !hasAdjacentAssignment(assignments, m.id, slot),
    ).length;

  // 埋まりにくいコマから（ただし日をまたいで偏りすぎないよう日程内順も考慮）
  const orderedSlots = [...SLOTS].sort((a, b) => {
    const da = availableCount(a) - a.needed;
    const db = availableCount(b) - b.needed;
    if (da !== db) return da - db;
    if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId);
    return SLOTS.indexOf(a) - SLOTS.indexOf(b);
  });

  for (const slot of orderedSlots) {
    const candidates = members.filter(
      (m) =>
        !m.ngSlotIds.includes(slot.id) &&
        !hasAdjacentAssignment(assignments, m.id, slot),
    );
    const loads = countLoads(assignments, memberIds);
    const dayLoads = countDayLoads(assignments, memberIds);

    const ranked = [...candidates].sort((a, b) => {
      const la = loads.get(a.id) ?? 0;
      const lb = loads.get(b.id) ?? 0;
      if (la !== lb) return la - lb;
      const ba = dayBalancePenalty(dayLoads, a.id, slot.dayId);
      const bb = dayBalancePenalty(dayLoads, b.id, slot.dayId);
      if (ba !== bb) return ba - bb;
      return a.name.localeCompare(b.name, "ja");
    });

    const picked: string[] = [];
    let i = 0;
    while (picked.length < slot.needed && i < ranked.length) {
      const load = loads.get(ranked[i].id) ?? 0;
      const bal = dayBalancePenalty(dayLoads, ranked[i].id, slot.dayId);
      let j = i;
      while (
        j < ranked.length &&
        (loads.get(ranked[j].id) ?? 0) === load &&
        dayBalancePenalty(dayLoads, ranked[j].id, slot.dayId) === bal
      ) {
        j++;
      }
      const band = ranked.slice(i, j);
      shuffleInPlace(band, rng);
      for (const m of band) {
        if (picked.length >= slot.needed) break;
        // 同コマ内で連続判定は不要だが、念のため二重追加防止
        if (picked.includes(m.id)) continue;
        picked.push(m.id);
        // 直後の候補判定用に仮反映
        assignments[slot.id] = picked;
      }
      i = j;
    }

    assignments[slot.id] = picked;

    if (picked.length < slot.needed) {
      const ngBlocked = members.filter((m) => m.ngSlotIds.includes(slot.id)).length;
      warnings.push({
        slotId: slot.id,
        shortfall: slot.needed - picked.length,
        message: `${slot.dayLabel} ${slot.start}–${slot.end} は ${picked.length}/${slot.needed}人（NG ${ngBlocked}人・連続シフト回避あり）。あと ${slot.needed - picked.length}人不足`,
      });
    }
  }

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
      let d1 = 0;
      let d2 = 0;
      for (const slot of SLOTS) {
        if (!assignments[slot.id].includes(m.id)) continue;
        count += 1;
        if (slot.dayId === "d1") d1 += 1;
        else d2 += 1;
      }
      return { member: m, count, d1, d2, dayDiff: Math.abs(d1 - d2) };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.dayDiff - a.dayDiff ||
        a.member.name.localeCompare(b.member.name, "ja"),
    );
}

/** 手動配置がルール違反か */
export function canPlaceInSlot(
  members: Member[],
  assignments: Assignments,
  slotId: SlotId,
  memberId: string,
): { ok: true } | { ok: false; reason: string } {
  const member = members.find((m) => m.id === memberId);
  if (!member) return { ok: false, reason: "メンバーが見つかりません" };
  if (member.ngSlotIds.includes(slotId)) {
    return { ok: false, reason: "NG時間帯のため入れられません" };
  }
  if (assignments[slotId].includes(memberId)) {
    return { ok: false, reason: "すでにこのコマに入っています" };
  }
  const slot = SLOTS.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "不明なコマです" };
  if (hasAdjacentAssignment(assignments, memberId, slot)) {
    return { ok: false, reason: "前後のコマと連続になるため入れられません" };
  }
  return { ok: true };
}
