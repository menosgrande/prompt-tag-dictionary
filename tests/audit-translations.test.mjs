import test from "node:test";
import assert from "node:assert/strict";
import { collectCandidates } from "../scripts/audit-translations.mjs";

const rows = [
  ["imizu (nitro unknown)", "イミズ（ニトロ不明）", "未分類", "未分類"],
  ["after vaginal", "膣性交後", "成人向け", "身体・衣類"],
  [":/", "口角の片下がり", "人物", "顔・表情"],
  [":|", "一文字口", "人物", "顔・表情"],
  ["ace attorney", "逆転裁判", "未分類", "未分類"],
  ["adventure time", "アドベンチャー・タイム", "未分類", "未分類"],
  ["battle axe", "戦斧", "服装", "装備"],
  ["albedo (genshin impact)", "アルベド（Genshin Impact）", "作品・キャラクター", "キャラクター"],
  ["ak-47", "AK-47", "未分類", "未分類"],
  ["zero gravity", "無重力", "未分類", "未分類"],
  ["empty", "", "未分類", "未分類"]
];

test("only a currently documented unresolved mistranslation is marked high-confidence", () => {
  const result = collectCandidates(rows);
  const item = result.find(x => x.tag === "imizu (nitro unknown)");
  assert.ok(item);
  assert.ok(item.reasons.includes("known-mistranslation"));
  assert.equal(item.confidence, "high");
});

test("corrected translations are not re-flagged by obsolete mistranslation rules", () => {
  const result = collectCandidates(rows);
  for (const tag of ["after vaginal", ":/", ":|", "ace attorney", "adventure time", "battle axe"]) {
    assert.equal(result.find(x => x.tag === tag), undefined, tag);
  }
});

test("legitimate romanized title and identifier remain review candidates, not confirmed errors", () => {
  const result = collectCandidates(rows);
  assert.equal(result.find(x => x.tag === "albedo (genshin impact)").confidence, "low");
  assert.equal(result.find(x => x.tag === "ak-47").reasons.includes("same-as-latin-tag"), true);
  assert.equal(result.find(x => x.tag === "zero gravity"), undefined);
});

test("missing translations are detected and review status is read without being upgraded", () => {
  const result = collectCandidates(rows, { "empty": { translationStatus: "needs-review" } });
  assert.equal(result.find(x => x.tag === "empty").reasons[0], "japanese-translation-missing");
  assert.equal(result.find(x => x.tag === "empty").status, "needs-review");
  assert.equal(result.find(x => x.tag === "imizu (nitro unknown)").status, "unreviewed");
});
