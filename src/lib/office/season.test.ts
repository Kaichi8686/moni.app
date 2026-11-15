import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTokyoMonthStart, previousSeasonKey, seasonKeyFor } from "./season";

describe("office season", () => {
  it("builds Tokyo season key", () => {
    // 2026-11-14 15:00 UTC = 2026-11-15 00:00 JST
    assert.equal(seasonKeyFor(new Date("2026-11-14T15:00:00Z")), "2026-11");
  });

  it("previous season rolls year", () => {
    assert.equal(previousSeasonKey(new Date("2026-01-05T00:00:00+09:00")), "2025-12");
  });

  it("detects JST month start at 15:00 UTC", () => {
    // 10/31 15:00 UTC = 11/1 00:00 JST
    assert.equal(isTokyoMonthStart(new Date("2026-10-31T15:00:00Z")), true);
    // 11/14 15:00 UTC = 11/15 00:00 JST
    assert.equal(isTokyoMonthStart(new Date("2026-11-14T15:00:00Z")), false);
  });
});
