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
    assert.ok(!gen.description.includes("…"));
    assert.ok(!gen.description.includes(about.slice(0, 20)));
    assert.ok(gen.description.includes("『moni』"));
  });
});
