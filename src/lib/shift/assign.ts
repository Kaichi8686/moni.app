import type {
  AssignedPerson,
  CellAssignment,
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftResponse,
} from "@/lib/shift/types";
import { cellKey } from "@/lib/shift/types";

const PREF_SCORE: Record<Pref, number> = {
  prefer: 100,
  ok: 40,
  ng: -10_000,
};

/** 同じスコア内での公平さを保つ簡易乱数（ボード code で決定的） */
function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const j = (h >>> 0) % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function defaultPref(response: ShiftResponse, key: string): Pref {
  return response.prefs[key] ?? "ok";
}

/**
 * 希望（○△×）・役割希望・負荷バランスを反映して割り振る。
 * 同一コマに同じ人が複数役割に入らない、かつ負荷が偏りすぎないようにする。
 */
export function assignShifts(board: ShiftBoard, responses: ShiftResponse[]): ShiftAssignmentResult {
  const loadByResponseId: Record<string, number> = {};
  for (const r of responses) loadByResponseId[r.id] = 0;

  const busy = new Map<string, Set<string>>(); // cellKey → responseIds already in that time
  const cells: CellAssignment[] = [];

  const roles = seededShuffle(board.roles, `${board.code}:roles`);
  const daySlotPairs: Array<{ dayId: string; slotId: string }> = [];
  for (const day of board.days) {
    for (const slot of board.slots) {
      daySlotPairs.push({ dayId: day.id, slotId: slot.id });
    }
  }
  const orderedPairs = seededShuffle(daySlotPairs, `${board.code}:pairs`);

  for (const { dayId, slotId } of orderedPairs) {
    const key = cellKey(dayId, slotId);
    if (!busy.has(key)) busy.set(key, new Set());

    for (const role of roles) {
      const needed = Math.max(0, Math.floor(role.needed));
      const taken = busy.get(key)!;
      const scored = seededShuffle(responses, `${board.code}:${key}:${role.id}`)
        .map((r) => {
          const pref = defaultPref(r, key);
          let score = PREF_SCORE[pref];
          if (pref === "ng") score = PREF_SCORE.ng;
          if (r.preferredRoleIds.includes(role.id)) score += 35;
          score -= (loadByResponseId[r.id] ?? 0) * 28;
          if (taken.has(r.id)) score -= 10_000;
          return { r, pref, score };
        })
        .filter((x) => x.score > -5_000)
        .sort((a, b) => b.score - a.score);

      const people: AssignedPerson[] = [];
      for (const item of scored) {
        if (people.length >= needed) break;
        if (taken.has(item.r.id)) continue;
        people.push({
          responseId: item.r.id,
          name: item.r.name,
          pref: item.pref,
        });
        taken.add(item.r.id);
        loadByResponseId[item.r.id] = (loadByResponseId[item.r.id] ?? 0) + 1;
      }

      cells.push({
        dayId,
        slotId,
        roleId: role.id,
        needed,
        people,
        shortfall: Math.max(0, needed - people.length),
      });
    }
  }

  // stable display order: days × slots × roles (original order)
  const roleOrder = new Map(board.roles.map((r, i) => [r.id, i]));
  const dayOrder = new Map(board.days.map((d, i) => [d.id, i]));
  const slotOrder = new Map(board.slots.map((s, i) => [s.id, i]));
  cells.sort((a, b) => {
    const dd = (dayOrder.get(a.dayId) ?? 0) - (dayOrder.get(b.dayId) ?? 0);
    if (dd) return dd;
    const ss = (slotOrder.get(a.slotId) ?? 0) - (slotOrder.get(b.slotId) ?? 0);
    if (ss) return ss;
    return (roleOrder.get(a.roleId) ?? 0) - (roleOrder.get(b.roleId) ?? 0);
  });

  const assignedIds = new Set(
    cells.flatMap((c) => c.people.map((p) => p.responseId)),
  );
  const unassignedNames = responses
    .filter((r) => !assignedIds.has(r.id))
    .map((r) => r.name);

  return {
    generatedAt: new Date().toISOString(),
    cells,
    loadByResponseId,
    unassignedNames,
  };
}

export function formatAssignmentsForLine(
  board: ShiftBoard,
  result: ShiftAssignmentResult,
): string {
  const dayMap = new Map(board.days.map((d) => [d.id, d]));
  const slotMap = new Map(board.slots.map((s) => [s.id, s]));
  const roleMap = new Map(board.roles.map((r) => [r.id, r]));

  const lines: string[] = [`【${board.title}】シフト表`, ""];

  let lastDay = "";
  let lastSlot = "";
  for (const cell of result.cells) {
    const day = dayMap.get(cell.dayId);
    const slot = slotMap.get(cell.slotId);
    const role = roleMap.get(cell.roleId);
    if (!day || !slot || !role) continue;

    if (day.id !== lastDay) {
      if (lastDay) lines.push("");
      lines.push(`■ ${day.label}${day.date ? `（${day.date}）` : ""}`);
      lastDay = day.id;
      lastSlot = "";
    }
    if (slot.id !== lastSlot) {
      lines.push(`／ ${slot.label}`);
      lastSlot = slot.id;
    }
    const names =
      cell.people.length > 0
        ? cell.people.map((p) => p.name).join("、")
        : "（空き）";
    const short = cell.shortfall > 0 ? ` ※あと${cell.shortfall}人` : "";
    lines.push(`　${role.name}：${names}${short}`);
  }

  if (result.unassignedNames.length > 0) {
    lines.push("");
    lines.push(`未割当：${result.unassignedNames.join("、")}`);
  }

  lines.push("");
  lines.push("※希望を優先して自動で割り振っています");
  return lines.join("\n");
}
