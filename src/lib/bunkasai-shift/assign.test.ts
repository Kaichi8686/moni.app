import assert from "node:assert/strict";
import { autoAssign, hasAdjacentAssignment, loadStats } from "./assign";
import { NEEDED, SLOTS, slotsForDay } from "./schedule";
import type { Member, MemberDependency } from "./types";

function members(n: number, maxShifts = 7): Member[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    name: `メンバー${String(i + 1).padStart(2, "0")}`,
    ngSlotIds: [],
    maxShifts,
  }));
}

{
  const result = autoAssign(members(40), 1);
  for (const slot of SLOTS) {
    assert.equal(result.assignments[slot.id].length, NEEDED, slot.id);
  }
}

{
  const ms = members(40);
  ms[0].ngSlotIds = ["d1-s1"];
  const result = autoAssign(ms, 2);
  assert.ok(!result.assignments["d1-s1"].includes("m0"));
}

{
  const result = autoAssign(members(40), 11);
  for (const dayId of ["d1", "d2"] as const) {
    const daySlots = slotsForDay(dayId);
    for (let i = 0; i < daySlots.length - 1; i++) {
      const a = new Set(result.assignments[daySlots[i].id]);
      for (const id of result.assignments[daySlots[i + 1].id]) {
        assert.ok(!a.has(id));
      }
    }
  }
}

{
  const ms = members(40);
  const cores = ["m0", "m1", "m2", "m3", "m4", "m5"];
  const result = autoAssign(ms, 21, { coreMemberIds: cores });
  for (const slot of SLOTS) {
    assert.ok(result.assignments[slot.id].some((id) => cores.includes(id)));
  }
}

// 同伴必須: m10 がいるコマには m11 もいる。m11 だけならOK
{
  const ms = members(40);
  const dependencies: MemberDependency[] = [
    { id: "d1", memberId: "m10", requiresId: "m11" },
  ];
  const result = autoAssign(ms, 33, { dependencies });
  for (const slot of SLOTS) {
    const ids = result.assignments[slot.id];
    if (ids.includes("m10")) {
      assert.ok(ids.includes("m11"), `m10 without m11 in ${slot.id}`);
    }
  }
}

// シフト上限
{
  const ms = members(40, 2);
  const result = autoAssign(ms, 55);
  const counts = new Map<string, number>();
  for (const slot of SLOTS) {
    for (const id of result.assignments[slot.id]) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  for (const [id, c] of counts) {
    assert.ok(c <= 2, `${id} has ${c} > 2`);
  }
}

{
  const stats = loadStats(members(36), autoAssign(members(36), 42).assignments);
  assert.ok(Math.max(...stats.map((s) => s.dayDiff)) <= 2);
}

{
  const result = autoAssign(members(40), 7);
  for (const slot of SLOTS) {
    for (const id of result.assignments[slot.id]) {
      assert.equal(hasAdjacentAssignment(result.assignments, id, slot), false);
    }
  }
}

console.log("bunkasai-shift assign tests ok");
