import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMangledOfflineDescription, offlineIncident } from "@/lib/office/offline";

describe("office offline incident text", () => {
  it("detects mangled about truncation", () => {
    assert.equal(
      isMangledOfflineDescription(
        "「moni」に想定外の依頼が来た。世界の子供達にビジネスチャンスを当てるためのアプリやサー…らしいチャンスの活かし方は？",
      ),
      true,
    );
    assert.equal(
      isMangledOfflineDescription("『moni』に想定外の依頼が来た。強みを活かすチャンスのつかみ方は？"),
      false,
    );
  });

  it("does not splice truncated about into the sentence", () => {
    const about = "世界の子供達にビジネスチャンスを当てるためのアプリやサービスを作る会社";
    const gen = offlineIncident({
      companyName: "moni",
      companyAbout: about,
      recentTitles: [],
    });
    assert.ok(!gen.description.includes("…らしい"));
    assert.ok(gen.description.includes("『moni』"));
    assert.equal(gen.strategies.length, 3);
    assert.equal(gen.targets.length, 4);
    assert.equal(gen.targets.filter((t) => t.fit === "mismatch").length, 1);
    for (const t of gen.targets) {
      assert.ok(!about.includes(t.label) || t.label.length < 4);
      assert.ok(!t.label.startsWith(about.slice(0, 4)));
    }
  });
});
