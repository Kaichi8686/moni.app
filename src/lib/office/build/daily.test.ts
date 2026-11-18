import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKeyFor, pickDailyDeal } from "@/lib/office/build/daily";

describe("daily deal", () => {
  it("is deterministic per date_key", () => {
    const a = pickDailyDeal("2026-11-18");
    const b = pickDailyDeal("2026-11-18");
    assert.equal(a.event.id, b.event.id);
    assert.deepEqual(
      a.hand.map((c) => c.id),
      b.hand.map((c) => c.id),
    );
  });

  it("differs across days", () => {
    const a = pickDailyDeal("2026-11-18");
    const b = pickDailyDeal("2026-11-19");
    const same =
      a.event.id === b.event.id &&
      a.hand.map((c) => c.id).join() === b.hand.map((c) => c.id).join();
    assert.equal(same, false);
  });

  it("formats JST date keys", () => {
    // 2026-11-17 16:00 UTC = 2026-11-18 01:00 JST
    assert.equal(dateKeyFor(new Date("2026-11-17T16:00:00Z")), "2026-11-18");
  });
});
