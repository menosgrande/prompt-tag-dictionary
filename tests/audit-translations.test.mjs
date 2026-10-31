import test from "node:test";
import assert from "node:assert/strict";
import { collectCandidates } from "../scripts/audit-translations.mjs";

const rows = [
  ["ace attorney", "エース弁護士", "作品・キャラクター", "作品名・シリーズ"],
  ["adventure time", "冒険の時間", "作品・キャラクター", "作品名・シリーズ"],
  ["adventurer (ff11)", "アバター（FF11）", "未分類", "未分類"],
  ["after vaginal", "膣の後", "未分類", "未分類"],
  [":/", "歪嘴", "未分類", "未分類"],
  [":|", "平嘴", "未分類", "未分類"],
  ["battle axe", "戦いx", "未分類", "未分類"],
  ["yuuji (and)", "ユウジ（そして）", "未分類", "未分類"],
  ["albedo (genshin impact)", "アルベド（Genshin Impact）", "作品・キャラクター", "キャラクター"],
  ["ak-47", "AK-47", "未分類", "未分類"],
  ["zero gravity", "無重力", "未分類", "未分類"],
  ["empty", "", "未分類", "未分類"]
];

test("known mistranslations are detected with high confidence", () => {
  const result = collectCandidates(rows);
  for (const tag of ["ace attorney", "adventure time", "adventurer (ff11)", "after vaginal", ":/", ":|", "battle axe", "yuuji (and)"]) {
    const item = result.find(x => x.tag === tag);
    assert.ok(item, tag + " should be detected");
    assert.ok(item.reasons.includes("known-mistranslation"), tag);
    assert.equal(item.confidence, "high", tag);
  }
});

test("legitimate romanized title and identifier remain low-confidence review candidates, not confirmed errors", () => {
  const result = collectCandidates(rows);
  assert.equal(result.find(x => x.tag === "albedo (genshin impact)").confidence, "low");
  assert.equal(result.find(x => x.tag === "ak-47").reasons.includes("same-as-latin-tag"), true);
  assert.equal(result.find(x => x.tag === "zero gravity"), undefined);
});

test("missing translations are detected and review status is read without being upgraded", () => {
  const result = collectCandidates(rows, { "empty": { translationStatus: "needs-review" } });
  assert.equal(result.find(x => x.tag === "empty").reasons[0], "japanese-translation-missing");
  assert.equal(result.find(x => x.tag === "empty").status, "needs-review");
  assert.equal(result.find(x => x.tag === "ace attorney").status, "unreviewed");
});
