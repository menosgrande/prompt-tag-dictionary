import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("browser loads canonical taxonomy and candidate sidecar",()=>{
  assert.match(app,/\.\/data\/tag-taxonomy\.json/);
  assert.match(app,/\.\/data\/tag-classification-candidates\.json/);
});

test("semantic category ids map to the nine prompt output positions",()=>{
  assert.match(app,/quality:0, person:1, clothing:2, pose:3, action:4, background:5, composition:6, style:7, lighting:8/);
});

test("negative output target is a separate virtual category filter",()=>{
  assert.match(app,/__outputTarget/);
  assert.match(app,/promptTargetOf\(t\)==="negative"/);
});

test("review-needed tags remain unclassified in browse but retain legacy output ordering",()=>{
  assert.match(app,/candidate\?\.status\s*===\s*"needs-review"/);
  assert.match(app,/candidate\?\.status === "needs-review" \?/);
});

test("provisional classifications are visibly labeled",()=>{
  assert.match(app,/新分類のAI候補。確定済みではありません。/);
  assert.match(html,/暫定5,750件、要確認136件、未分類5,161件/);
});
