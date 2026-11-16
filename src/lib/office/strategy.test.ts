import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcRevenue } from "./revenue";
import { lerp, originalBonus, strategyMultiplier } from "./strategy";

describe("office strategy multiplier", () => {
  it("lerps safely", () => {
    assert.equal(lerp(0, 10, 0), 0);
    assert.equal(lerp(0, 10, 1), 10);
    assert.equal(lerp(0, 10, 0.5), 5);
  });

  it("safe stays near 1.0", () => {
    assert.ok(Math.abs(strategyMultiplier("safe", 0) - 0.9) < 1e-9);
    assert.ok(Math.abs(strategyMultiplier("safe", 100) - 1.1) < 1e-9);
  });

  it("bold swings hard around 60", () => {
    assert.ok(strategyMultiplier("bold", 59) <= 0.9);
    assert.ok(strategyMultiplier("bold", 60) >= 1.2);
    assert.ok(Math.abs(strategyMultiplier("bold", 100) - 1.8) < 1e-9);
  });

  it("custom bonus only when high score", () => {
    assert.equal(originalBonus("custom", 70), 0.1);
    assert.equal(originalBonus("custom", 69), 0);
    assert.equal(originalBonus("s1", 99), 0);
  });

  it("revenue includes multiplier and similar cut", () => {
    const r = calcRevenue({
      scoreTotal: 80,
      size: 2,
      strategyKind: "standard",
      strategyId: "s2",
    });
    // multiplier = 0.8 + 0.5*0.8 = 1.2 → 80*2*10*1.2 = 1920
    assert.equal(r.revenue, 1920);

    const similar = calcRevenue({
      scoreTotal: 80,
      size: 2,
      strategyKind: "standard",
      strategyId: "s2",
      wasSimilar: true,
    });
    assert.equal(similar.revenue, Math.round(1920 * 0.3));

    const custom = calcRevenue({
      scoreTotal: 80,
      size: 1,
      strategyKind: "custom",
      strategyId: "custom",
    });
    assert.equal(custom.isOriginal, true);
    assert.equal(custom.originalBonus, 0.1);
  });
});
