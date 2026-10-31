import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const taxonomy = JSON.parse(await readFile(new URL("../data/tag-taxonomy.json", import.meta.url), "utf8"));
const promptOrder = JSON.parse(await readFile(new URL("../data/prompt-order-categories.json", import.meta.url), "utf8"));

test("browser loads canonical taxonomy and candidate sidecar",()=>{
  assert.match(app,/\.\/data\/tag-taxonomy\.json/);
  assert.match(app,/\.\/data\/tag-classification-candidates\.json/);
});

test("canonical taxonomy defines ten categories in prompt order",()=>{
  const ids = taxonomy.semanticCategories.slice().sort((a,b)=>a.order-b.order).map(c=>c.id);
  assert.deepEqual(ids,["quality","person","character","clothing","pose","action","background","composition","style","lighting"]);
  assert.deepEqual(promptOrder.categories.map(c=>c.name),taxonomy.semanticCategories.slice().sort((a,b)=>a.order-b.order).map(c=>c.name));
  assert.match(app,/quality:0, person:1, character:2, clothing:3, pose:4, action:5, background:6, composition:7, style:8, lighting:9/);
});

test("person appearance and work-character identity are separate",()=>{
  const person = taxonomy.semanticCategories.find(c=>c.id==="person");
  const character = taxonomy.semanticCategories.find(c=>c.id==="character");
  assert.ok(person.subcategories.some(s=>s.id==="hair-head"));
  assert.ok(!person.subcategories.some(s=>["works-series","characters","creators"].includes(s.id)));
  assert.deepEqual(character.subcategories.map(s=>s.id),["works-series","characters","creators"]);
  assert.match(app,/candidate\\?\\.categoryId === "person".*works-series/);
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
