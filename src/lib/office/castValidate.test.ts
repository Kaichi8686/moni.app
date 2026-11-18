import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCastName, validateOwnerName } from "@/lib/office/castValidate";

describe("validateCastName", () => {
  it("accepts normal names", () => {
    assert.equal(validateCastName("ハルト"), null);
    assert.equal(validateOwnerName("社長くん"), null);
  });

  it("rejects length and contacts", () => {
    assert.ok(validateCastName(""));
    assert.ok(validateCastName("あ".repeat(13)));
    assert.ok(validateCastName("a@b.com"));
    assert.ok(validateCastName("09012345678"));
  });

  it("rejects NG words", () => {
    assert.ok(validateCastName("バカ太郎"));
  });
});
