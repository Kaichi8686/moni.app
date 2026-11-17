import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextLoginStreak, tokyoDateKey } from "@/lib/office/loginStreak";

describe("nextLoginStreak", () => {
  it("starts at 1 on first visit", () => {
    const now = new Date("2026-11-18T03:00:00Z"); // JST 12:00
    const r = nextLoginStreak(0, null, now);
    assert.equal(r.streak, 1);
    assert.equal(r.lastDate, tokyoDateKey(now));
    assert.equal(r.changed, true);
  });

  it("keeps streak on same day", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const today = tokyoDateKey(now);
    const r = nextLoginStreak(3, today, now);
    assert.equal(r.streak, 3);
    assert.equal(r.changed, false);
  });

  it("increments after consecutive day", () => {
    const now = new Date("2026-11-18T03:00:00Z"); // JST Nov 18
    const r = nextLoginStreak(2, "2026-11-17", now);
    assert.equal(r.streak, 3);
    assert.equal(r.changed, true);
  });

  it("resets after a gap", () => {
    const now = new Date("2026-11-18T03:00:00Z");
    const r = nextLoginStreak(5, "2026-11-15", now);
    assert.equal(r.streak, 1);
  });
});
