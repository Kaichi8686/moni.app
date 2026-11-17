import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidTargetLabel, targetsPassValidation } from "@/lib/office/targetValidate";
import type { IncidentTargetInternal } from "@/lib/office/types";

describe("isValidTargetLabel", () => {
  const about = "世界の子供達にビジネスの機会を与える";

  it("accepts short noun phrases", () => {
    assert.equal(isValidTargetLabel("小学生の保護者", about), true);
    assert.equal(isValidTargetLabel("初めて来た人", about), true);
  });

  it("rejects over 12 chars", () => {
    assert.equal(isValidTargetLabel("とても長いターゲットラベルですよ", about), false);
  });

  it("rejects about text and prefixes", () => {
    assert.equal(isValidTargetLabel(about, about), false);
    assert.equal(isValidTargetLabel("世界の子供達にビジネ", about), false);
    assert.equal(isValidTargetLabel("世界の子供達に", about), false);
  });
});

describe("targetsPassValidation", () => {
  it("requires four valid labels", () => {
    const about = "地域の子ども向けプログラミング教室";
    const ok: IncidentTargetInternal[] = [
      { id: "t1", label: "熱心なファン", fit: "good" },
      { id: "t2", label: "初めての人", fit: "good" },
      { id: "t3", label: "保護者", fit: "ok" },
      { id: "t4", label: "無関心の人", fit: "mismatch" },
    ];
    assert.equal(targetsPassValidation(ok, about), true);
    const bad = ok.map((t, i) => (i === 2 ? { ...t, label: about.slice(0, 10) } : t));
    assert.equal(targetsPassValidation(bad, about), false);
  });
});
