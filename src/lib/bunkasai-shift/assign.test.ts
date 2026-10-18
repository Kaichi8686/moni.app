import assert from "node:assert/strict";
import { autoAssign, hasAdjacentAssignment, loadStats } from "./assign";
import { NEEDED, SLOTS, slotsForDay } from "./schedule";
import type { Member, MemberPair } from "./types";

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
}

{
  const ms = members(40);
  ms[0].ngSlotIds = ["d1-s1"];
  const result = autoAssign(ms, 2);
  assert.ok(!result.assignments["d1-s1"].includes("m0"));
}

// 連続禁止
{
  const result = autoAssign(members(40), 11);
  for (const dayId of ["d1", "d2"] as const) {
    const daySlots = slotsForDay(dayId);
    for (let i = 0; i < daySlots.length - 1; i++) {
      const a = new Set(result.assignments[daySlots[i].id]);
      for (const id of result.assignments[daySlots[i + 1].id]) {
        assert.ok(!a.has(id), `consecutive ${daySlots[i].id}`);
      }
    }
  }
}

// コア：各コマにコアが1人以上
{
  const ms = members(40);
  const cores = ["m0", "m1", "m2", "m3", "m4", "m5"];
  const result = autoAssign(ms, 21, { coreMemberIds: cores });
  for (const slot of SLOTS) {
    const has = result.assignments[slot.id].some((id) => cores.includes(id));
    assert.ok(has, `core missing in ${slot.id}`);
  }
}

// ペア：同じコマに同時
{
  const ms = members(40);
  const pairs: MemberPair[] = [{ id: "p1", memberIds: ["m10", "m11"] }];
  const result = autoAssign(ms, 33, { pairs });
  for (const slot of SLOTS) {
    const ids = result.assignments[slot.id];
    const a = ids.includes("m10");
    const b = ids.includes("m11");
    assert.equal(a, b, `pair split in ${slot.id}`);
  }
}

{
  const stats = loadStats(members(36), autoAssign(members(36), 42).assignments);
  const maxDiff = Math.max(...stats.map((s) => s.dayDiff));
  assert.ok(maxDiff <= 2, `dayDiff ${maxDiff}`);
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
