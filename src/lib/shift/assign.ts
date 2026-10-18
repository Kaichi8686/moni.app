import type {
  AssignedPerson,
  CellAssignment,
  ManualCellInput,
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftResponse,
  ShiftSlot,
} from "@/lib/shift/types";
import { cellKey, normalizeBoard, slotsForDay, workSlotsForDay } from "@/lib/shift/types";

const PREF_SCORE: Record<Pref, number> = {
  prefer: 100,
  ok: 40,
  ng: -10_000,
};

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

function workSlotIds(slots: ShiftSlot[]): string[] {
  return slots.filter((s) => !s.isBreak).map((s) => s.id);
}

function consecutiveCount(
  assignedByDay: Map<string, Set<string>>,
  dayId: string,
  workOrder: string[],
  slotId: string,
  responseId: string,
): number {
  const set = assignedByDay.get(`${dayId}:${responseId}`) ?? new Set();
  const idx = workOrder.indexOf(slotId);
  if (idx < 0) return 0;
  let left = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (set.has(workOrder[i]!)) left += 1;
    else break;
  }
  let right = 0;
  for (let i = idx + 1; i < workOrder.length; i++) {
    if (set.has(workOrder[i]!)) right += 1;
    else break;
  }
  return left + right + 1;
}

/**
 * 希望（○△×）・役割希望・負荷・連続制限・休み時間・バディを反映して割り振る。
 */
export function assignShifts(boardIn: ShiftBoard, responses: ShiftResponse[]): ShiftAssignmentResult {
  const board = normalizeBoard(boardIn);
  const loadByResponseId: Record<string, number> = {};
  for (const r of responses) loadByResponseId[r.id] = 0;

  const busy = new Map<string, Set<string>>();
  const assignedByDay = new Map<string, Set<string>>(); // `${dayId}:${responseId}` → slotIds
  const cells: CellAssignment[] = [];
  const workOrderByDay = new Map(
    board.days.map((d) => [d.id, workSlotIds(slotsForDay(board, d.id))]),
  );
  const maxConsec = Math.max(0, board.schedule.maxConsecutive || 0);

  const nameToId = new Map(responses.map((r) => [r.name.trim(), r.id]));
  const buddyOf = new Map<string, string[]>();
  for (const pair of board.schedule.buddyPairs ?? []) {
    const a = nameToId.get(pair.nameA.trim());
    const b = nameToId.get(pair.nameB.trim());
    if (!a || !b || a === b) continue;
    buddyOf.set(a, [...(buddyOf.get(a) ?? []), b]);
    buddyOf.set(b, [...(buddyOf.get(b) ?? []), a]);
  }

  const roles = seededShuffle(board.roles, `${board.code}:roles`);
  const daySlotPairs: Array<{ dayId: string; slotId: string }> = [];
  for (const day of board.days) {
    for (const slot of workSlotsForDay(board, day.id)) {
      daySlotPairs.push({ dayId: day.id, slotId: slot.id });
    }
  }
  const orderedPairs = seededShuffle(daySlotPairs, `${board.code}:pairs`);

  for (const { dayId, slotId } of orderedPairs) {
    const key = cellKey(dayId, slotId);
    if (!busy.has(key)) busy.set(key, new Set());
    const workOrder = workOrderByDay.get(dayId) ?? [];

    for (const role of roles) {
      const needed = Math.max(0, Math.floor(role.needed));
      const taken = busy.get(key)!;
      const scored = seededShuffle(responses, `${board.code}:${key}:${role.id}`)
        .map((r) => {
          const pref = defaultPref(r, key);
          let score = PREF_SCORE[pref];
          if (pref === "ng") return { r, pref, score: PREF_SCORE.ng };
          if (taken.has(r.id)) return { r, pref, score: -10_000 };
          if (r.preferredRoleIds.includes(role.id)) score += 35;
          score -= (loadByResponseId[r.id] ?? 0) * 28;

          if (maxConsec > 0) {
            const would = consecutiveCount(assignedByDay, dayId, workOrder, slotId, r.id);
            if (would > maxConsec) return { r, pref, score: -10_000 };
            if (would === maxConsec) score -= 20;
          }

          const buddies = buddyOf.get(r.id) ?? [];
          for (const bid of buddies) {
            if (taken.has(bid)) score += 45;
          }

          return { r, pref, score };
        })
        .filter((x) => x.score > -5_000)
        .sort((a, b) => b.score - a.score);

      const people: AssignedPerson[] = [];
      for (const item of scored) {
        if (people.length >= needed) break;
        if (taken.has(item.r.id)) continue;
        if (maxConsec > 0) {
          const would = consecutiveCount(assignedByDay, dayId, workOrder, slotId, item.r.id);
          if (would > maxConsec) continue;
        }
        people.push({
          responseId: item.r.id,
          name: item.r.name,
          pref: item.pref,
        });
        taken.add(item.r.id);
        loadByResponseId[item.r.id] = (loadByResponseId[item.r.id] ?? 0) + 1;
        const dayKey = `${dayId}:${item.r.id}`;
        if (!assignedByDay.has(dayKey)) assignedByDay.set(dayKey, new Set());
        assignedByDay.get(dayKey)!.add(slotId);
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

  const assignedIds = new Set(cells.flatMap((c) => c.people.map((p) => p.responseId)));
  const unassignedNames = responses.filter((r) => !assignedIds.has(r.id)).map((r) => r.name);

  return {
    generatedAt: new Date().toISOString(),
    cells,
    loadByResponseId,
    unassignedNames,
  };
}

export function formatAssignmentsForLine(
  boardIn: ShiftBoard,
  result: ShiftAssignmentResult,
): string {
  const board = normalizeBoard(boardIn);
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
      cell.people.length > 0 ? cell.people.map((p) => p.name).join("、") : "（空き）";
    const short = cell.shortfall > 0 ? ` ※あと${cell.shortfall}人` : "";
    lines.push(`　${role.name}：${names}${short}`);
  }

  for (const day of board.days) {
    const breaks = board.slots.filter((s) => s.isBreak);
    if (breaks.length === 0) continue;
    if (!result.cells.some((c) => c.dayId === day.id)) continue;
  }

  if (result.unassignedNames.length > 0) {
    lines.push("");
    lines.push(`未割当：${result.unassignedNames.join("、")}`);
  }

  lines.push("");
  lines.push("※オーナーが作成したシフト表です");
  return lines.join("\n");
}

export function formatMemberLineInvite(title: string, memberUrl: string): string {
  return [
    `【${title}】シフト希望を教えて！`,
    "",
    "下のリンクを開いて、名前と ○△× を入れてね。",
    "○＝入りたい　△＝入れる　×＝無理",
    "",
    memberUrl,
  ].join("\n");
}

export function formatScheduleViewInvite(title: string, viewUrl: string): string {
  return [`【${title}】シフト表はこちら`, "", viewUrl].join("\n");
}

/**
 * 管理画面の手動割り振りを ShiftAssignmentResult に正規化する。
 * 同じ時間帯に同一メンバーを二重配置した場合はエラー。
 */
export function buildManualAssignments(
  boardIn: ShiftBoard,
  responses: ShiftResponse[],
  cellsIn: ManualCellInput[],
): ShiftAssignmentResult {
  const board = normalizeBoard(boardIn);
  const responseById = new Map(responses.map((r) => [r.id, r]));
  const roleMap = new Map(board.roles.map((r) => [r.id, r]));
  const dayIds = new Set(board.days.map((d) => d.id));
  const validWork = new Set(
    board.days.flatMap((d) => workSlotsForDay(board, d.id).map((s) => `${d.id}:${s.id}`)),
  );
  const loadByResponseId: Record<string, number> = {};
  for (const r of responses) loadByResponseId[r.id] = 0;

  const busy = new Map<string, Set<string>>();
  const cells: CellAssignment[] = [];

  for (const day of board.days) {
    for (const slot of workSlotsForDay(board, day.id)) {
      for (const role of board.roles) {
        const incoming =
          cellsIn.find(
            (c) => c.dayId === day.id && c.slotId === slot.id && c.roleId === role.id,
          ) ?? null;
        const key = cellKey(day.id, slot.id);
        if (!busy.has(key)) busy.set(key, new Set());
        const taken = busy.get(key)!;
        const people: AssignedPerson[] = [];
        for (const p of incoming?.people ?? []) {
          const res = responseById.get(p.responseId);
          if (!res) throw new Error("UNKNOWN_MEMBER");
          if (taken.has(res.id)) throw new Error("DOUBLE_BOOKED");
          taken.add(res.id);
          people.push({ responseId: res.id, name: res.name, pref: "ok" });
          loadByResponseId[res.id] = (loadByResponseId[res.id] ?? 0) + 1;
        }
        const needed = Math.max(0, Math.floor(role.needed));
        cells.push({
          dayId: day.id,
          slotId: slot.id,
          roleId: role.id,
          needed,
          people,
          shortfall: Math.max(0, needed - people.length),
        });
      }
    }
  }

  for (const c of cellsIn) {
    if (!dayIds.has(c.dayId) || !validWork.has(`${c.dayId}:${c.slotId}`) || !roleMap.has(c.roleId)) {
      throw new Error("INVALID_CELL");
    }
  }

  const assignedIds = new Set(cells.flatMap((c) => c.people.map((p) => p.responseId)));
  const unassignedNames = responses.filter((r) => !assignedIds.has(r.id)).map((r) => r.name);

  return {
    generatedAt: new Date().toISOString(),
    cells,
    loadByResponseId,
    unassignedNames,
  };
}
