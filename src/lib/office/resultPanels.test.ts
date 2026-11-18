import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResultPanels,
  parseResultPanels,
  reactionForTone,
} from "@/lib/office/resultPanels";

describe("buildResultPanels", () => {
  it("returns situation → choice → outcome", () => {
    const panels = buildResultPanels({
      incidentTitle: "行列パニック",
      incidentLine: "お客さんが止まらない！",
      strategyTitle: "並べ替え作戦",
      targetLabels: ["新人", "常連"],
      story: "並びが整い、怒り顔が減った。売上も戻った。",
      storyTone: "great",
    });
    assert.equal(panels.length, 3);
    assert.equal(panels[0]!.kind, "situation");
    assert.equal(panels[1]!.kind, "choice");
    assert.equal(panels[2]!.kind, "outcome");
    assert.match(panels[1]!.body, /並べ替え作戦/);
    assert.equal(panels[2]!.emotion, "happy");
  });
});

describe("reactionForTone", () => {
  it("maps tones", () => {
    assert.equal(reactionForTone("great").emotion, "happy");
    assert.equal(reactionForTone("bitter").emotion, "worried");
    assert.equal(reactionForTone("ok").emotion, "smug");
  });
});

describe("parseResultPanels", () => {
  it("round-trips", () => {
    const panels = buildResultPanels({
      incidentTitle: "炎上",
      strategyTitle: "謝罪",
      targetLabels: ["広報"],
      story: "落ち着いた。",
      storyTone: "ok",
    });
    const parsed = parseResultPanels(panels);
    assert.ok(parsed);
    assert.equal(parsed![0]!.caption, panels[0]!.caption);
  });
});
