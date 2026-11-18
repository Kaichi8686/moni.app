import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAST_ROLES } from "@/lib/office/scenes";
import { ensureCompanyCast, generateCompanyCast, parseCompanyCast } from "@/lib/office/cast";

describe("generateCompanyCast", () => {
  it("returns six unique roles", () => {
    const cast = generateCompanyCast("seed-a");
    assert.equal(cast.length, 6);
    const roles = new Set(cast.map((c) => c.role));
    assert.equal(roles.size, 6);
    for (const role of CAST_ROLES) assert.ok(roles.has(role));
    const names = new Set(cast.map((c) => c.name));
    assert.equal(names.size, 6);
  });

  it("is deterministic for the same seed", () => {
    const a = generateCompanyCast("same");
    const b = generateCompanyCast("same");
    assert.deepEqual(a, b);
  });
});

describe("parseCompanyCast", () => {
  it("rejects incomplete cast", () => {
    assert.equal(parseCompanyCast([]), null);
    assert.equal(parseCompanyCast(null), null);
  });

  it("ensure falls back to generated", () => {
    const cast = ensureCompanyCast(null, "x");
    assert.equal(cast.length, 6);
  });
});
