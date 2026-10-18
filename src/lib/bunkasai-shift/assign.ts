import { SLOTS, emptyAssignments, slotsForDay } from "./schedule";
import type {
  AssignOptions,
  AssignResult,
  Assignments,
  DayId,
  Member,
  MemberDependency,
  ShiftSlot,
  SlotId,
} from "./types";

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
  const afterAbs = Math.abs(thisDay + 1 - otherDay);
  const beforeAbs = Math.abs(thisDay - otherDay);
  return thisDay * 1000 + afterAbs * 10 + (afterAbs > beforeAbs ? 5 : 0);
}

function requireMap(deps: MemberDependency[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of deps) {
    if (d.memberId && d.requiresId && d.memberId !== d.requiresId) {
      map.set(d.memberId, d.requiresId);
    }
  }
  return map;
}

/**
 * memberId を入れるときに一緒に必要な人（本人＋同伴必須を辿る）。
 * 例: A→B, B→C なら A は [A,B,C]
 */
export function requiredUnit(memberId: string, deps: MemberDependency[]): string[] {
  const map = requireMap(deps);
  const out: string[] = [memberId];
  const seen = new Set<string>([memberId]);
  let cur = memberId;
  while (map.has(cur)) {
    const next = map.get(cur)!;
    if (seen.has(next)) break;
    seen.add(next);
    out.push(next);
    cur = next;
  }
  return out;
}

/** この人が外れたら、依存している人も外す対象 */
export function dependentsOf(memberId: string, deps: MemberDependency[]): string[] {
  const map = requireMap(deps);
  const out: string[] = [];
  for (const who of map.keys()) {
    let cur: string = who;
    const seen = new Set<string>();
    while (map.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      const nextReq: string = map.get(cur)!;
      if (nextReq === memberId) {
        out.push(who);
        break;
      }
      cur = nextReq;
    }
  }
  return out;
}

function unitLoadSum(loads: Map<string, number>, unit: string[]): number {
  return unit.reduce((sum, id) => sum + (loads.get(id) ?? 0), 0);
}

function unitDayPenalty(
  dayLoads: Record<DayId, Map<string, number>>,
  unit: string[],
  dayId: DayId,
): number {
  return Math.max(...unit.map((id) => dayBalancePenalty(dayLoads, id, dayId)));
}

function canPlaceUnit(
  membersById: Map<string, Member>,
  assignments: Assignments,
  slot: ShiftSlot,
  unit: string[],
  alreadyPicked: string[],
): boolean {
  const needNew = unit.filter((id) => !alreadyPicked.includes(id));
  const roomLeft = slot.needed - alreadyPicked.length;
  if (needNew.length > roomLeft) return false;
  for (const id of needNew) {
    const m = membersById.get(id);
    if (!m) return false;
    if (m.ngSlotIds.includes(slot.id)) return false;
    const provisional: Assignments = {
      ...assignments,
      [slot.id]: [...alreadyPicked],
    };
    if (hasAdjacentAssignment(provisional, id, slot)) return false;
  }
  return true;
}

/**
 * NG・連続禁止・コア必ず1人・同伴必須を守りつつ各コマを埋める。
 * メンバー名簿自体は変更しない。
 */
export function autoAssign(
  members: Member[],
  seed = Date.now(),
  options: AssignOptions = {},
): AssignResult {
  const assignments = emptyAssignments();
  const warnings: AssignResult["warnings"] = [];
  const rng = mulberry32(seed >>> 0);
  const memberIds = members.map((m) => m.id);
  const byId = new Map(members.map((m) => [m.id, m]));
  const coreSet = new Set((options.coreMemberIds ?? []).filter((id) => byId.has(id)));
  const deps = (options.dependencies ?? []).filter(
    (d) => byId.has(d.memberId) && byId.has(d.requiresId),
  );

  const availableCount = (slot: ShiftSlot) =>
    members.filter(
      (m) =>
        !m.ngSlotIds.includes(slot.id) &&
        !hasAdjacentAssignment(assignments, m.id, slot),
    ).length;

  const orderedSlots = [...SLOTS].sort((a, b) => {
    const da = availableCount(a) - a.needed;
    const db = availableCount(b) - b.needed;
    if (da !== db) return da - db;
    if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId);
    return SLOTS.indexOf(a) - SLOTS.indexOf(b);
  });

  for (const slot of orderedSlots) {
    const picked: string[] = [];
    const loads = () => countLoads(assignments, memberIds);
    const dayLoads = () => countDayLoads(assignments, memberIds);

    const rankUnits = (units: string[][]) => {
      const L = loads();
      const D = dayLoads();
      return [...units].sort((ua, ub) => {
        const la = unitLoadSum(L, ua);
        const lb = unitLoadSum(L, ub);
        if (la !== lb) return la - lb;
        const ba = unitDayPenalty(D, ua, slot.dayId);
        const bb = unitDayPenalty(D, ub, slot.dayId);
        if (ba !== bb) return ba - bb;
        const na = byId.get(ua[0])?.name ?? "";
        const nb = byId.get(ub[0])?.name ?? "";
        return na.localeCompare(nb, "ja");
      });
    };

    const tryAddUnit = (unit: string[]): boolean => {
      if (!canPlaceUnit(byId, assignments, slot, unit, picked)) return false;
      for (const id of unit) {
        if (!picked.includes(id)) picked.push(id);
      }
      assignments[slot.id] = [...picked];
      return true;
    };

    // 1) コアを先に確保（コア本人が誰かを必要とするなら同伴も）
    if (coreSet.size > 0) {
      const coreUnits = new Map<string, string[]>();
      for (const id of coreSet) {
        const unit = requiredUnit(id, deps);
        coreUnits.set(unit.join("|"), unit);
      }
      let placedCore = false;
      for (const unit of rankUnits([...coreUnits.values()])) {
        if (tryAddUnit(unit)) {
          placedCore = true;
          break;
        }
      }
      if (!placedCore) {
        warnings.push({
          slotId: slot.id,
          shortfall: 0,
          message: `${slot.dayLabel} ${slot.start}–${slot.end} にコアメンバーを入れられませんでした（NG・連続・同伴必須）`,
        });
      }
    }

    // 2) 残りを埋める
    const fillUnits = members.map((m) => requiredUnit(m.id, deps));
    // 重複ユニット除去（同じ閉包）
    const unique = new Map<string, string[]>();
    for (const unit of fillUnits) {
      unique.set([...unit].sort().join("|"), unit);
    }

    const ranked = rankUnits([...unique.values()]);
    let i = 0;
    while (picked.length < slot.needed && i < ranked.length) {
      const L = loads();
      const D = dayLoads();
      const load0 = unitLoadSum(L, ranked[i]);
      const bal0 = unitDayPenalty(D, ranked[i], slot.dayId);
      let j = i;
      while (
        j < ranked.length &&
        unitLoadSum(L, ranked[j]) === load0 &&
        unitDayPenalty(D, ranked[j], slot.dayId) === bal0
      ) {
        j++;
      }
      const band = ranked.slice(i, j);
      shuffleInPlace(band, rng);
      for (const unit of band) {
        if (picked.length >= slot.needed) break;
        // すでに全員入っているならスキップ
        if (unit.every((id) => picked.includes(id))) continue;
        tryAddUnit(unit);
      }
      i = j;
    }

    assignments[slot.id] = picked;

    const hasCore = coreSet.size === 0 || picked.some((id) => coreSet.has(id));
    if (!hasCore && !warnings.some((w) => w.slotId === slot.id && w.message.includes("コア"))) {
      warnings.push({
        slotId: slot.id,
        shortfall: 0,
        message: `${slot.dayLabel} ${slot.start}–${slot.end} にコアメンバーがいません`,
      });
    }

    if (picked.length < slot.needed) {
      warnings.push({
        slotId: slot.id,
        shortfall: slot.needed - picked.length,
        message: `${slot.dayLabel} ${slot.start}–${slot.end} は ${picked.length}/${slot.needed}人。あと ${slot.needed - picked.length}人不足（連続・同伴必須・NGの影響）`,
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

export function canPlaceInSlot(
  members: Member[],
  assignments: Assignments,
  slotId: SlotId,
  memberId: string,
  options: AssignOptions = {},
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

  const deps = options.dependencies ?? [];
  const unit = requiredUnit(memberId, deps);
  const byId = new Map(members.map((m) => [m.id, m]));
  if (!canPlaceUnit(byId, assignments, slot, unit, assignments[slotId])) {
    const missing = unit.filter((id) => id !== memberId && !assignments[slotId].includes(id));
    const names = missing.map((id) => byId.get(id)?.name ?? "?").join("・");
    return {
      ok: false,
      reason: names
        ? `${names} も同時に入れられないため配置できません`
        : "同伴必須の条件を満たせません",
    };
  }
  return { ok: true };
}

/** @deprecated 互換: 旧 unitForMember */
export function unitForMember(memberId: string, deps: MemberDependency[]): string[] {
  return requiredUnit(memberId, deps);
}
