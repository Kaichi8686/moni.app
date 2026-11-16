import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guessIndustryFromAbout,
  normalizeCompanyAbout,
  parseCompanyAbout,
} from "@/lib/office/about";

describe("office about", () => {
  it("normalizes whitespace and length", () => {
    assert.equal(normalizeCompanyAbout("  放課後  アプリ  "), "放課後 アプリ");
    assert.equal(parseCompanyAbout("短い"), null);
    assert.equal(parseCompanyAbout("文化祭向けにアプリを作る部活"), "文化祭向けにアプリを作る部活");
  });

  it("guesses industry from keywords", () => {
    assert.equal(guessIndustryFromAbout("スマホ注文アプリを作るチーム"), "tech");
    assert.equal(guessIndustryFromAbout("近所のカフェを営む"), "food");
    assert.equal(guessIndustryFromAbout("ただの会社ですよ本当に"), null);
  });
});
