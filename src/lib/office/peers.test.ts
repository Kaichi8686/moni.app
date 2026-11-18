import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clipPeerAnswer, shouldHidePeer } from "@/lib/office/peers";
import { OFFICE_PEER_REPORT_HIDE_AT } from "@/lib/office/scenes";

describe("peers helpers", () => {
  it("clips long answers", () => {
    const long = "あ".repeat(200);
    const clipped = clipPeerAnswer(long, 40);
    assert.ok(clipped.length <= 40);
    assert.ok(clipped.endsWith("…"));
  });

  it("hides after report threshold", () => {
    assert.equal(shouldHidePeer(OFFICE_PEER_REPORT_HIDE_AT - 1), false);
    assert.equal(shouldHidePeer(OFFICE_PEER_REPORT_HIDE_AT), true);
  });
});
