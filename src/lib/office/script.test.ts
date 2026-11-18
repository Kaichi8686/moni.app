import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyNamePlaceholders,
  defaultDialogueForType,
  parseIncidentDialogue,
} from "@/lib/office/script";
import { generateCompanyCast } from "@/lib/office/cast";

describe("parseIncidentDialogue", () => {
  it("accepts default dialogue", () => {
    const d = defaultDialogueForType("pinch");
    const parsed = parseIncidentDialogue(d);
    assert.ok(parsed);
    assert.equal(parsed!.script.length >= 3, true);
    assert.equal(parsed!.questions.length, 3);
  });

  it("rejects short script", () => {
    const d = defaultDialogueForType("chance");
    const bad = { ...d, script: d.script.slice(0, 1) };
    assert.equal(parseIncidentDialogue(bad), null);
  });

  it("rejects overlong lines", () => {
    const d = defaultDialogueForType("people");
    const bad = {
      ...d,
      script: d.script.map((b, i) =>
        i === 0 ? { ...b, line: "あ".repeat(41) } : b,
      ),
    };
    assert.equal(parseIncidentDialogue(bad), null);
  });
});

describe("applyNamePlaceholders", () => {
  it("replaces role placeholders", () => {
    const cast = generateCompanyCast("seed");
    const newbie = cast.find((c) => c.role === "newbie")!;
    const out = applyNamePlaceholders("{name:newbie}が来た", cast);
    assert.equal(out, `${newbie.name}が来た`);
  });
});
