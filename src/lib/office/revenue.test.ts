import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRevenueGrowth, calcRevenue } from "./revenue";

describe("office revenue", () => {
  it("applies multiplier to base formula", () => {
    const r = calcRevenue({
      scoreTotal: 100,
      size: 1,
      strategyKind: "safe",
      strategyId: "s1",
    });
    // safe@100 → 1.1 → 100*1*10*1.1 = 1100
    assert.equal(r.revenue, 1100);
    assert.equal(r.multiplier, 1.1);
  });

  it("similar cuts to 30% after multiplier", () => {
    const r = calcRevenue({
      scoreTotal: 100,
      size: 1,
      strategyKind: "safe",
      strategyId: "s1",
      wasSimilar: true,
    });
    assert.equal(r.revenue, Math.round(1100 * 0.3));
  });

  it("grows level from thresholds", () => {
    const r = applyRevenueGrowth(400, 200);
    assert.equal(r.totalRevenue, 600);
    assert.equal(r.level, 2);
  });
});
