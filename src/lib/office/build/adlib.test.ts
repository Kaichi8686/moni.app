import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adlibMultFromScores } from "@/lib/office/build/adlib";

describe("adlibMultFromScores", () => {
  it("maps scores into 1.0–2.0", () => {
    assert.equal(adlibMultFromScores(0, 0, true), 1);
    assert.equal(adlibMultFromScores(100, 100, true), 2);
    assert.ok(Math.abs(adlibMultFromScores(50, 50, true) - 1.5) < 1e-9);
  });

  it("forces 1.0 when unsafe", () => {
    assert.equal(adlibMultFromScores(100, 100, false), 1);
  });
});
