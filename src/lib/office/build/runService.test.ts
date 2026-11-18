import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryRunStore } from "@/lib/office/build/localBuildStore";
import {
  diagnoseRun,
  ensureStarterCompany,
  playRun,
  previewRun,
  RunServiceError,
  startRun,
} from "@/lib/office/build/runService";

function seedStore() {
  const store = createMemoryRunStore(
    ensureStarterCompany({
      id: "co1",
      userId: "u1",
      name: "放課後ラボ",
      about: "テスト会社の説明文ですよ",
      industry: "food",
      coins: 0,
      mood: "good",
      streak: 0,
      totalRevenue: 0,
      level: 1,
      stamina: 5,
      staminaUpdatedAt: new Date().toISOString(),
      tutorialDone: false,
      rankingEnabled: true,
      sfxMuted: true,
      ownerName: "カイ",
    }),
  );
  return store;
}

describe("run state machine", () => {
  it("starts daily once and blocks second finish day", async () => {
    const store = seedStore();
    const now = new Date("2026-11-18T03:00:00Z");
    const a = startRun(store, "u1", "daily", now);
    assert.equal(a.created, true);
    assert.equal(a.run.hand.length, 5);
    assert.ok(!("correct" in a.run.event.hypotheses[0]!));

    const again = startRun(store, "u1", "daily", now);
    assert.equal(again.created, false);
    assert.equal(again.run.id, a.run.id);

    const hyp = a.run.event.hypotheses[0]!.id;
    diagnoseRun(store, "u1", a.run.id, hyp, now);

    const handIds = a.run.hand.map((c) => c.id);
    const played = [handIds[0]!, handIds[1]!].filter(Boolean).slice(0, 2);
    // cost may exceed — pick cheapest valid
    const cheap = a.run.hand
      .slice()
      .sort((x, y) => x.cost - y.cost)
      .slice(0, 2)
      .map((c) => c.id);

    previewRun(store, "u1", a.run.id, cheap, now);
    const finished = await playRun(store, "u1", a.run.id, cheap, undefined, undefined, now);
    assert.equal(finished.run.status, "finished");
    assert.ok((finished.run.revenue ?? 0) > 0);

    assert.throws(
      () => startRun(store, "u1", "daily", now),
      (e: unknown) => e instanceof RunServiceError && e.status === 409,
    );
  });

  it("consumes stamina on free mode", () => {
    const store = seedStore();
    const now = new Date("2026-11-18T03:00:00Z");
    const before = store.getCompany("u1")!.stamina;
    startRun(store, "u1", "free", now);
    assert.equal(store.getCompany("u1")!.stamina, before - 1);
  });

  it("rejects play before diagnose", async () => {
    const store = seedStore();
    const now = new Date("2026-11-18T03:00:00Z");
    const { run } = startRun(store, "u1", "daily", now);
    const cheap = run.hand
      .slice()
      .sort((x, y) => x.cost - y.cost)
      .slice(0, 1)
      .map((c) => c.id);
    await assert.rejects(
      () => playRun(store, "u1", run.id, cheap, undefined, undefined, now),
      RunServiceError,
    );
  });
});
