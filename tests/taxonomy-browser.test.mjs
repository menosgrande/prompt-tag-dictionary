import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const taxonomy = JSON.parse(await readFile(new URL("../data/tag-taxonomy.json", import.meta.url), "utf8"));
const promptOrder = JSON.parse(await readFile(new URL("../data/prompt-order-categories.json", import.meta.url), "utf8"));

test("browser loads the consolidated runtime dictionary bundle",()=>{
  assert.match(app,/\.\/data\/dictionary-data\.json/);
  assert.match(app,/seedDictionaryData\(\)/);
  assert.match(app,/dictionaryData\?\.taxonomy/);
  assert.match(app,/dictionaryData\?\.classificationCandidates/);
});

test("canonical taxonomy defines all categories in prompt order",()=>{
  const ids = taxonomy.semanticCategories.slice().sort((a,b)=>a.order-b.order).map(c=>c.id);
  assert.deepEqual(ids,["quality","people-count","character","person","face","hair","clothing","pose","action","background","objects","vehicles","composition","style","lighting","living-things","text-symbols"]);
  assert.deepEqual(promptOrder.categories.map(c=>c.name),taxonomy.semanticCategories.slice().sort((a,b)=>a.order-b.order).map(c=>c.name));
  assert.match(app,/find\(category => category\.id === taxonomyCategoryId\(candidate\)\)/);
});

test("person appearance and work-character identity are separate",()=>{
  const person = taxonomy.semanticCategories.find(c=>c.id==="person");
  const character = taxonomy.semanticCategories.find(c=>c.id==="character");
  assert.ok(person.subcategories.some(s=>s.id==="body-shape"));
  assert.ok(taxonomy.semanticCategories.find(c=>c.id==="face").subcategories.some(s=>s.id==="eyes-feature"));
  assert.ok(taxonomy.semanticCategories.find(c=>c.id==="hair").subcategories.some(s=>s.id==="hair-head-core"));
  assert.ok(!person.subcategories.some(s=>["works-series","characters","creators"].includes(s.id)));
  assert.equal(taxonomy.semanticCategories.find(c=>c.id==="lighting").subcategories.find(s=>s.id==="color-tone").hidden,true);
  assert.deepEqual(character.subcategories.map(s=>s.id),["works-series","characters","creators"]);
  assert.doesNotMatch(app,/candidate\?\.categoryId === "person".*works-series/);
});

test("negative tags are displayed under quality but retain a separate output target",()=>{
  assert.equal(taxonomy.virtualViews.find(v=>v.target==="negative").parentCategory,"quality");
  assert.ok(taxonomy.semanticCategories.find(c=>c.id==="quality").subcategories.some(s=>s.id==="negative-exclusions"));
  assert.match(app,/__outputTarget/);
  assert.match(app,/promptTargetOf\(t\) === "negative"/);
});

test("NSFW rating labels use LV.1 through LV.4 independently of taxonomy levels",()=>{
  assert.deepEqual(taxonomy.rating.displayLevels,[
    {level:"LV.1",value:"全年齢"},
    {level:"LV.2",value:"R-13"},
    {level:"LV.3",value:"R-15"},
    {level:"LV.4",value:"R-18"}
  ]);
  assert.equal(taxonomy.rating.unreviewedLabel,"未判定");
});

test("provisional classifications remain visibly labeled",()=>{
  assert.match(app,/新分類のAI候補。確定済みではありません。/);
  assert.ok(html.includes("暫定"));
});

test("needs-review and unclassified tags have separate filters and counts",()=>{
  assert.match(app,/__classificationStatus/);
  assert.match(app,/candidate\?\.status==="needs-review"/);
  assert.match(app,/!classificationOf\(t\) && majorOf\(t\)==="未分類"/);
  assert.match(app,/addFilterButton\("要確認",needsReviewCount/);
  assert.match(app,/addFilterButton\("未分類",unclassifiedCount/);
});
