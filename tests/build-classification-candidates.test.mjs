import test from "node:test";
import assert from "node:assert/strict";
import { classifyLegacyRow, buildClassificationCandidates } from "../scripts/build-classification-candidates.mjs";

test("person face tags map to the new person taxonomy",()=>{
  const item=classifyLegacyRow(["smile","笑顔","人物","顔・表情"]);
  assert.equal(item.categoryId,"person");
  assert.equal(item.subcategoryId,"face-expression");
  assert.equal(item.status,"provisional");
});

test("clothing subtype is split by tag meaning",()=>{
  assert.equal(classifyLegacyRow(["bikini","ビキニ","服装","下着・水着"]).subcategoryId,"swimwear");
  assert.equal(classifyLegacyRow(["panties","パンティー","服装","下着・水着"]).subcategoryId,"underwear");
});

test("ambiguous situation tags remain needs-review",()=>{
  const item=classifyLegacyRow(["wedding","結婚式","シチュエーション","イベント"]);
  assert.equal(item.status,"needs-review");
  assert.equal(item.categoryId,"");
});

test("unclassified tags are not forced into a category",()=>{
  assert.equal(classifyLegacyRow(["unknown","不明","未分類","未分類"]),null);
});

test("summary accounts for every tag",()=>{
  const report=buildClassificationCandidates([
    ["smile","笑顔","人物","顔・表情"],
    ["bikini","ビキニ","服装","下着・水着"],
    ["wedding","結婚式","シチュエーション","イベント"],
    ["unknown","不明","未分類","未分類"]
  ]);
  assert.equal(report.summary.totalTags,4);
  assert.equal(report.summary.proposed,2);
  assert.equal(report.summary.needsReview,1);
  assert.equal(report.summary.unclassified,1);
});
