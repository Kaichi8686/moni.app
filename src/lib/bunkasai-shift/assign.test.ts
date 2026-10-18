import assert from "node:assert/strict";
import { autoAssign } from "./assign";
import { NEEDED, SLOTS } from "./schedule";
import type { Member } from "./types";

function members(n: number): Member[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    name: `メンバー${i + 1}`,
    ngSlotIds: [],
  }));
}

{
  const result = autoAssign(members(27), 1);
  for (const slot of SLOTS) {
    assert.equal(result.assignments[slot.id].length, NEEDED);
  }
  assert.equal(result.warnings.length, 0);
}

{
  const ms = members(20);
  ms[0].ngSlotIds = ["d1-s1"];
  const result = autoAssign(ms, 2);
  assert.ok(!result.assignments["d1-s1"].includes("m0"));
}

{
  const result = autoAssign(members(5), 3);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.assignments["d1-s1"].length < NEEDED);
}

console.log("bunkasai-shift assign tests ok");
