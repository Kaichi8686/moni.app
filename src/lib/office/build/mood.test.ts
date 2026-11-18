import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcMood, moodTitle } from "@/lib/office/build/mood";

describe("calcMood", () => {
  it("returns good when fewer than 3 runs", () => {
    assert.equal(calcMood({ recentRatios: [2, 2], streak: 5 }), "good");
  });

  it("returns great for strong average and streak", () => {
    assert.equal(calcMood({ recentRatios: [1.5, 1.5, 1.5], streak: 3 }), "great");
  });

  it("returns crisis for weak average and no streak", () => {
    assert.equal(calcMood({ recentRatios: [0.2, 0.2, 0.2], streak: 0 }), "crisis");
  });

  it("returns low in the middle band", () => {
    // m = 0.6 * min(1.0/1.5,1) = 0.4 → low
    const mood = calcMood({ recentRatios: [1.0, 1.0, 1.0], streak: 0 });
    assert.equal(mood, "low");
  });
});

describe("moodTitle", () => {
  it("names streak titles", () => {
    assert.equal(moodTitle("great", 3), "3日連続 絶好調");
    assert.equal(moodTitle("good", 3), null);
  });
});
