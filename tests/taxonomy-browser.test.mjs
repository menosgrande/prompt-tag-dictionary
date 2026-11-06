import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const runtime = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const taxonomy = runtime.taxonomy;
const promptOrder = runtime.promptOrder;

test("browser loads the consolidated runtime dictionary bundle",()=>{
  assert.match(app,/\.\/data\/dictionary-data\.json/);
  assert.match(app,/seedDictionaryData\(\)/);
  assert.match(app,/dictionaryData\?\.taxonomy/);
  assert.match(app,/dictionaryData\?\.classificationCandidates/);
});

test("canonical taxonomy defines all categories in prompt order",()=>{
  const ids = taxonomy.semanticCategories.slice().sort((a,b)=>a.order-b.order).map(c=>c.id);
  assert.deepEqual(ids,["quality","people-count","character","person","face","hair","clothing","pose","action","state-context","background","objects","vehicles","composition","style","lighting","living-things","text-symbols"]);
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

test("work groups have a visible entry in the taxonomy tree",()=>{
  const character = taxonomy.semanticCategories.find(c=>c.id==="character");
  const works = character.subcategories.find(s=>s.id==="works-series");
  assert.ok(works, "work-series taxonomy entry must exist");
  assert.match(app,/isWorkGroupView=category\.id==="character"&&sub\.id==="works-series"/);
  assert.match(app,/tagGroups\.filter\(group=>group\.type==="work"\)\.length/);
  assert.match(app,/const workBrowse = state\.category\?\.\[0\] === "キャラクター・作品" && state\.category\?\.\[1\] === "作品・シリーズ"/);
  assert.match(app,/tagGroups\.filter\(group => group\.type === "work" && \(workBrowse \|\| !!q\)/);
});

test("negative tags are displayed under quality but retain a separate output target",()=>{
  assert.equal(taxonomy.virtualViews.find(v=>v.target==="negative").parentCategory,"quality");
  assert.ok(taxonomy.semanticCategories.find(c=>c.id==="quality").subcategories.some(s=>s.id==="negative-exclusions"));
  assert.match(app,/__outputTarget/);
  assert.match(app,/promptTargetOf\(t\) === "negative"/);
});

test("quality parent filter includes the negative virtual view without double-counting",()=>{
  assert.match(app,/negativeOutsideQualityCount = state\.tags\.filter\(t =>\s*promptTargetOf\(t\) === "negative" && majorOf\(t\) !== taxonomyCategoryName\("quality"\)/);
  assert.match(app,/const displayTotal = entry\.total \+ \(category\.id === "quality" \? negativeOutsideQualityCount : 0\)/);
  assert.match(app,/majorOf\(t\) !== state\.category\[0\] && promptTargetOf\(t\) !== "negative"/);
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
  assert.match(app,/classificationOf\(t\)\?\.status==="needs-review"/);
  assert.match(app,/!classificationOf\(t\) && majorOf\(t\)==="未分類"/);
  assert.match(app,/addFilterButton\("要確認",needsReviewCount/);
  assert.match(app,/addFilterButton\("未分類",unclassifiedCount/);
});

test("special classification filters use readable result titles",()=>{
  assert.match(app,/state\.category\[0\] === "__outputTarget" && state\.category\[1\] === "negative" \? "ネガティブ・除外指定"/);
  assert.match(app,/state\.category\[0\] === "__classificationStatus" && state\.category\[1\] === "needs-review" \? "要確認"/);
  assert.match(app,/state\.category\[0\] === "__classificationStatus" && state\.category\[1\] === "unclassified" \? "未分類"/);
});

test("packed tag metadata survives canonical bundle loading and normalization",()=>{
  assert.match(app,/\.\.\.\(obj\[6\] && typeof obj\[6\] === "object"/);
  assert.match(app,/\.\.\.item,/);
  assert.match(app,/\.\.\.metadata,/);
  assert.match(app,/classificationCandidates/);
});

test("admin classification review edits stay synchronized with embedded candidates",async()=>{
  const admin=await readFile(new URL("../src/admin.js",import.meta.url),"utf8");
  assert.match(admin,/function syncClassificationCandidate\(/);
  assert.match(admin,/delete meta\.classification/);
  assert.match(admin,/entries\[index\]=candidate/);
  assert.match(admin,/classificationCandidates:state\.dictionary\.classificationCandidates/);
});

test("work group cards render each tag only once and share global selection state",()=>{
  assert.match(app,/const renderedWorkTags = new Set\(\)/);
  assert.match(app,/if \(renderedWorkTags\.has\(key\)\) return/);
  assert.match(app,/renderedWorkTags\.add\(key\)/);
  assert.match(app,/checkbox\.checked = state\.selected\.has\(norm\(member\.tag\)\)/);
  assert.match(app,/checkbox\.addEventListener\("change", \(\) => toggleSelected\(member\)\)/);
  assert.match(app,/function toggleSelected\(t\) \{\s*const key = norm\(t\.tag\);\s*if \(state\.selected\.has\(key\)\) state\.selected\.delete\(key\); else state\.selected\.add\(key\)/);
});
