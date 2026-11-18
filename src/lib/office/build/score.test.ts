import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardById } from "@/lib/office/build/content/cards";
import { OFFICE_COMBOS } from "@/lib/office/build/content/combos";
import { calcCoins, rankFromRatio, scoreRun, ScoreValidationError } from "@/lib/office/build/score";

function must(id: string) {
  const c = cardById(id);
  assert.ok(c, id);
  return c;
}

describe("scoreRun golden", () => {
  it("matches the Balatro-style golden numbers", () => {
    const played = [
      must("organize_ticket"),
      must("student_discount"),
      must("set_deal"),
    ];
    // ゴールデンは弱点一致・コンボなしで 90_000 × 1.3
    const result = scoreRun({
      baseCustomers: 100,
      basePrice: 500,
      norma: 80_000,
      weakTags: [],
      played,
      handIds: played.map((c) => c.id),
      combos: [],
      hypothesisMult: 1.3,
      adlibMult: 1.0,
      moodBefore: "good",
    });

    assert.equal(result.customers, 150);
    assert.equal(result.price, 600);
    assert.equal(result.customers * result.price, 90_000);
    assert.equal(result.revenue, 117_000);
    assert.ok(Math.abs(result.ratio - 117_000 / 80_000) < 1e-6);
    assert.equal(result.rank, "S");
    assert.equal(result.coins, 1_170);
    assert.ok(result.triggerLog.length >= 3);
  });
});

describe("scoreRun validation", () => {
  it("rejects cards not in hand, over budget, over 3", () => {
    const a = must("organize_ticket");
    assert.throws(
      () =>
        scoreRun({
          baseCustomers: 100,
          basePrice: 500,
          norma: 80_000,
          weakTags: [],
          played: [a],
          handIds: ["other"],
          combos: [],
          hypothesisMult: 1,
          adlibMult: 1,
          moodBefore: "good",
        }),
      ScoreValidationError,
    );

    const costly = [must("word_of_mouth"), must("premium_topping"), must("flash_sale")];
    assert.throws(
      () =>
        scoreRun({
          baseCustomers: 100,
          basePrice: 500,
          norma: 80_000,
          weakTags: [],
          played: costly,
          handIds: costly.map((c) => c.id),
          combos: [],
          hypothesisMult: 1,
          adlibMult: 1,
          moodBefore: "good",
        }),
      ScoreValidationError,
    );
  });

  it("applies weak tag boost and combos", () => {
    const played = [must("organize_ticket"), must("staff_brief")];
    const result = scoreRun({
      baseCustomers: 100,
      basePrice: 500,
      norma: 80_000,
      weakTags: ["queue"],
      played,
      handIds: played.map((c) => c.id),
      combos: OFFICE_COMBOS,
      hypothesisMult: 1,
      adlibMult: 1,
      moodBefore: "good",
    });
    // organize_ticket +20 * 1.2 = 24, staff_brief mult 1.1, queue+ops combo 1.15
    assert.equal(result.customers, 124);
    assert.ok(result.comboIds.includes("queue_ops"));
    assert.ok(result.mult > 1.1);
  });
});

describe("rank and coins", () => {
  it("maps ratio bands", () => {
    assert.equal(rankFromRatio(1.4), "S");
    assert.equal(rankFromRatio(1.1), "A");
    assert.equal(rankFromRatio(1.0), "B");
    assert.equal(rankFromRatio(0.99), "C");
  });

  it("applies fail cut and crisis rebuild bonus", () => {
    assert.equal(calcCoins(10_000, 0.5, "good"), 50);
    assert.equal(calcCoins(10_000, 1.0, "crisis"), 120);
  });
});
