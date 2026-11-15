import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { charBigramJaccard, isTooSimilar } from "./similarity";

describe("office similarity", () => {
  it("identical texts are 1", () => {
    assert.equal(charBigramJaccard("カフェを広めよう", "カフェを広めよう"), 1);
  });

  it("detects near-duplicates over threshold", () => {
    const a = "社員のやる気を上げるために朝会を短くして成果を共有する";
    const b = "社員のやる気を上げるために朝会を短くして成果をみんなで共有する";
    assert.ok(charBigramJaccard(a, b) >= 0.8);
    assert.equal(isTooSimilar(b, [a], 0.8), true);
  });

  it("different texts are low", () => {
    assert.ok(charBigramJaccard("ピザを売る", "宇宙旅行に行く") < 0.5);
  });
});
