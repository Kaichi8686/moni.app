import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CODEX_TYPES,
  emptyCodex,
  isCodexComplete,
  unlockCodexCell,
} from "@/lib/office/codex";
import { OFFICE_CODEX_COMPLETE_BONUS, OFFICE_CODEX_FIRST_BONUS, OFFICE_SCENES } from "@/lib/office/scenes";

describe("unlockCodexCell", () => {
  it("awards first-clear bonus", () => {
    const r = unlockCodexCell(emptyCodex(), "queue", "pinch", 70);
    assert.equal(r.isFirstClear, true);
    assert.equal(r.bonus, OFFICE_CODEX_FIRST_BONUS);
    assert.equal(r.cells.length, 1);
  });

  it("updates best score without bonus on repeat", () => {
    const first = unlockCodexCell(emptyCodex(), "queue", "pinch", 60);
    const second = unlockCodexCell(first.cells, "queue", "pinch", 90);
    assert.equal(second.isFirstClear, false);
    assert.equal(second.bonus, 0);
    assert.equal(second.cell.bestScore, 90);
  });

  it("awards complete bonus when grid fills", () => {
    let cells = emptyCodex();
    for (const scene of OFFICE_SCENES) {
      for (const type of CODEX_TYPES) {
        if (scene === "new_hire" && type === "rival") break;
        cells = unlockCodexCell(cells, scene, type, 50).cells;
      }
    }
    assert.equal(isCodexComplete(cells), false);
    const last = unlockCodexCell(cells, "new_hire", "rival", 80);
    assert.equal(last.isComplete, true);
    assert.equal(last.bonus, OFFICE_CODEX_FIRST_BONUS + OFFICE_CODEX_COMPLETE_BONUS);
  });
});
