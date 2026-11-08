import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateBundle } from "../scripts/build-dictionary-data.mjs";

const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));

test("canonical dictionary passes the single-file schema audit", () => {
  assert.deepEqual(validateBundle(bundle), []);
});

test("rejects obsolete packed review index", () => {
  const copy = structuredClone(bundle);
  copy.review = { entries: [] };
  assert.ok(validateBundle(copy).some(error => error.includes("Obsolete packed review index")));
});

test("rejects duplicate normalized tags", () => {
  const copy = structuredClone(bundle);
  copy.tags.push([...copy.tags[0]]);
  assert.ok(validateBundle(copy).some(error => error.includes("Normalized duplicate tag")));
});

test("rejects prompt order that differs from canonical taxonomy", () => {
  const copy = structuredClone(bundle);
  copy.promptOrder.categories = copy.promptOrder.categories.slice(1);
  assert.ok(validateBundle(copy).some(error => error.includes("Prompt output category order does not match the canonical taxonomy")));
});

test("rejects a tag whose verified Japanese candidate differs from its displayed translation", () => {
  const copy = structuredClone(bundle);
  const row = copy.tags.find(item => item[6]?.translation?.status === "verified" && typeof item[6].translation.candidateJa === "string");
  if (!row) return;
  row[6].translation.candidateJa += "不一致";
  assert.ok(validateBundle(copy).some(error => error.includes("Verified translation candidateJa must match ja")));
});
