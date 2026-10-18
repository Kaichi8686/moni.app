import assert from "node:assert/strict";
import { autoAssign, hasAdjacentAssignment, loadStats } from "./assign";
import { NEEDED, SLOTS, slotsForDay } from "./schedule";
import type { Member } from "./types";

function members(n: number): Member[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    name: `メンバー${String(i + 1).padStart(2, "0")}`,
    ngSlotIds: [],
  }));
}

{
  const result = autoAssign(members(40), 1);
  for (const slot of SLOTS) {
    assert.equal(result.assignments[slot.id].length, NEEDED, slot.id);
  }
  assert.equal(result.warnings.length, 0);
}

{
  const ms = members(40);
  ms[0].ngSlotIds = ["d1-s1"];
  const result = autoAssign(ms, 2);
  assert.ok(!result.assignments["d1-s1"].includes("m0"));
}

{
  const result = autoAssign(members(5), 3);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.assignments["d1-s1"].length < NEEDED);
}

// 2連続シフト禁止
{
  const ms = members(40);
  const result = autoAssign(ms, 11);
  for (const dayId of ["d1", "d2"] as const) {
    const daySlots = slotsForDay(dayId);
    for (let i = 0; i < daySlots.length - 1; i++) {
      const a = new Set(result.assignments[daySlots[i].id]);
      const b = result.assignments[daySlots[i + 1].id];
      for (const id of b) {
        assert.ok(
          !a.has(id),
          `consecutive ${daySlots[i].id}-${daySlots[i + 1].id} has ${id}`,
        );
      }
    }
  }
  for (const slot of SLOTS) {
    for (const id of result.assignments[slot.id]) {
      assert.equal(hasAdjacentAssignment(result.assignments, id, slot), false);
    }
  }
}

// 1日目と2日目の差ができるだけ小さい
{
  const ms = members(36);
  const result = autoAssign(ms, 42);
  const stats = loadStats(ms, result.assignments);
  const maxDiff = Math.max(...stats.map((s) => s.dayDiff));
  assert.ok(maxDiff <= 2, `dayDiff too large: ${maxDiff}`);
}

console.log("bunkasai-shift assign tests ok");
