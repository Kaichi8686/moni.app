import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OFFICE_STAMINA_RECOVER_MS } from "./constants";
import { computeStamina, consumeStamina, formatStaminaDots } from "./stamina";

describe("office stamina", () => {
  it("does not recover when full", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    const s = computeStamina(5, new Date("2026-11-14T00:00:00Z"), now);
    assert.equal(s.value, 5);
    assert.equal(s.nextRecoverAt, null);
  });

  it("recovers 1 per 30 minutes", () => {
    const updated = new Date("2026-11-15T00:00:00Z");
    const now = new Date(updated.getTime() + OFFICE_STAMINA_RECOVER_MS * 2 + 1000);
    const s = computeStamina(2, updated, now);
    assert.equal(s.value, 4);
  });

  it("caps at max", () => {
    const updated = new Date("2026-11-15T00:00:00Z");
    const now = new Date(updated.getTime() + OFFICE_STAMINA_RECOVER_MS * 10);
    const s = computeStamina(3, updated, now);
    assert.equal(s.value, 5);
  });

  it("consume fails at 0", () => {
    const now = new Date("2026-11-15T00:00:00Z");
    const r = consumeStamina(0, now, now);
    assert.equal(r.ok, false);
    assert.equal(r.state.value, 0);
  });

  it("consume from full resets timer", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const r = consumeStamina(5, new Date("2026-11-01T00:00:00Z"), now);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state.value, 4);
    assert.equal(r.state.updatedAt.getTime(), now.getTime());
  });

  it("format dots", () => {
    assert.equal(formatStaminaDots(3), "●●●○○");
  });
});
