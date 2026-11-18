import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMeterDecay,
  applyMetersDelta,
  computeMetersDelta,
  defaultMeters,
  metersAllHigh,
  metersRevenueMultiplier,
} from "@/lib/office/meters";

describe("applyMeterDecay", () => {
  it("moves toward 50 by 5 per day", () => {
    const meters = { ...defaultMeters(), morale: 80, cash: 20 };
    const now = new Date("2026-11-18T00:00:00Z");
    const updated = new Date("2026-11-16T00:00:00Z"); // 2 days
    const next = applyMeterDecay(meters, updated, now);
    assert.equal(next.morale, 70);
    assert.equal(next.cash, 30);
    assert.equal(next.customers, 50);
  });
});

describe("computeMetersDelta", () => {
  it("applies only at-risk meters", () => {
    const delta = computeMetersDelta({
      scoreTotal: 80,
      strategyKind: "standard",
      metersAtRisk: ["morale", "reputation"],
    });
    assert.ok(delta.morale != null && delta.morale > 0);
    assert.ok(delta.reputation != null);
    assert.equal(delta.customers, undefined);
  });

  it("safe is smaller swing than bold", () => {
    const safe = computeMetersDelta({
      scoreTotal: 80,
      strategyKind: "safe",
      metersAtRisk: ["cash"],
    });
    const bold = computeMetersDelta({
      scoreTotal: 80,
      strategyKind: "bold",
      metersAtRisk: ["cash"],
    });
    assert.ok(Math.abs(bold.cash ?? 0) > Math.abs(safe.cash ?? 0));
  });

  it("bold amplifies negative when score < 60", () => {
    const delta = computeMetersDelta({
      scoreTotal: 40,
      strategyKind: "bold",
      metersAtRisk: ["customers"],
    });
    assert.ok((delta.customers ?? 0) < 0);
  });
});

describe("applyMetersDelta + revenue bonus", () => {
  it("clamps and detects all-high", () => {
    const base = defaultMeters();
    const next = applyMetersDelta(base, { morale: 30, customers: 30, reputation: 30, cash: 30 });
    assert.ok(metersAllHigh(next));
    assert.equal(metersRevenueMultiplier(next), 1.1);
    assert.equal(metersRevenueMultiplier(base), 1);
  });
});
