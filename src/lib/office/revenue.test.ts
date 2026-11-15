import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRevenueGrowth, calcRevenue } from "./revenue";

describe("office revenue", () => {
  it("base formula score * size * 10", () => {
    assert.equal(calcRevenue({ scoreTotal: 80, size: 2 }), 1600);
  });

  it("similar cuts to 30%", () => {
    assert.equal(calcRevenue({ scoreTotal: 80, size: 2, wasSimilar: true }), 480);
  });

  it("grows level from thresholds", () => {
    const r = applyRevenueGrowth(400, 200);
    assert.equal(r.totalRevenue, 600);
    assert.equal(r.level, 2);
  });
});
