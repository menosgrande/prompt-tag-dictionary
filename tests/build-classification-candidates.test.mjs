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

test("interpersonal hand contact is not misclassified as hand-only action",()=>{
  const item=classifyLegacyRow(["holding hands","手をつなぐ","ポーズ・動作","行動"]);
  assert.equal(item.subcategoryId,"interpersonal-contact");
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


test("work, character, and creator tags map directly to the character taxonomy",()=>{
  for (const [minor,subcategory] of [["作品名・シリーズ","works-series"],["キャラクター","characters"],["作者・配信者","creators"]]) {
    const item=classifyLegacyRow(["example","例","作品・キャラクター",minor]);
    assert.equal(item.categoryId,"character");
    assert.equal(item.subcategoryId,subcategory);
  }
});


test("legacy color tags are not assigned to an independent color category",()=>{
  const item=classifyLegacyRow(["black hair","黒髪","光・色彩","色"]);
  assert.equal(item.categoryId,"");
  assert.equal(item.status,"needs-review");
  assert.match(item.reason,/色そのものを独立カテゴリにしない/);
});

test("legacy lighting tags still map to lighting",()=>{
  const item=classifyLegacyRow(["backlighting","逆光","光・色彩","照明"]);
  assert.equal(item.categoryId,"lighting");
  assert.equal(item.subcategoryId,"lighting-source");
});

test("semantic color audit overrides candidates while retaining review states",()=>{
  const rows=[
    ["red shirt","赤いシャツ","光・色彩","色"],
    ["fox shadow puppet","キツネの影絵","光・色彩","影"]
  ];
  const audit={
    source_blob_sha:"test-sha",
    entries:[
      {index:0,tag:"red shirt",ja:"赤いシャツ",legacy:{major:"光・色彩",minor:"色"},target:{categoryId:"clothing",subcategoryId:"clothing"},status:"proposed",confidence:"high",reason:"衣服を示す。"},
      {index:1,tag:"fox shadow puppet",ja:"キツネの影絵",legacy:{major:"光・色彩",minor:"影"},target:null,status:"needs-review",confidence:"low",reason:"意味の確認が必要。"}
    ]
  };
  const report=buildClassificationCandidates(rows,audit);
  const proposed=report.entries.find(item=>item.tag==="red shirt");
  const review=report.entries.find(item=>item.tag==="fox shadow puppet");
  assert.equal(proposed.categoryId,"clothing");
  assert.equal(proposed.subcategoryId,"clothing");
  assert.equal(proposed.status,"provisional");
  assert.equal(proposed.auditSourceIndex,0);
  assert.equal(review.status,"needs-review");
  assert.equal(review.categoryId,"");
  assert.equal(review.subcategoryId,"");
  assert.equal(report.summary.proposed,1);
  assert.equal(report.summary.needsReview,1);
  assert.equal(report.migrationAudit.covered,2);
});

test("semantic color audit rejects stale tag, translation, or legacy source data",()=>{
  const rows=[["red shirt","赤いシャツ","光・色彩","色"]];
  const audit={entries:[{index:0,tag:"red shirt",ja:"赤いシャツ",legacy:{major:"光・色彩",minor:"照明"},target:{categoryId:"clothing",subcategoryId:"clothing"},status:"proposed",confidence:"high",reason:"衣服。"}]};
  assert.throws(()=>buildClassificationCandidates(rows,audit),/Audit source mismatch/);
});

test("arm warmers are classified as clothing rather than body parts",()=>{
  const item=classifyLegacyRow(["arm warmers","アームウォーマー","人物","身体・部位"]);
  assert.equal(item.categoryId,"clothing");
  assert.equal(item.subcategoryId,"clothing");
  assert.equal(item.status,"provisional");
});
