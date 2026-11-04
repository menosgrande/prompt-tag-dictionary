import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateBundle } from "../scripts/build-dictionary-data.mjs";

const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));

test("canonical dictionary passes the single-file schema audit", () => {
  assert.deepEqual(validateBundle(bundle), []);
});

test("rejects review metadata whose index no longer matches tag rows", () => {
  const copy = structuredClone(bundle);
  copy.review.entries.pop();
  assert.ok(validateBundle(copy).some(error => error.includes("review.entries")));
});

test("rejects duplicate normalized tags", () => {
  const copy = structuredClone(bundle);
  copy.tags.push([...copy.tags[0]]);
  assert.ok(validateBundle(copy).some(error => error.includes("Normalized duplicate tag")));
});
