import { readFile, writeFile } from "node:fs/promises";
const bundlePath = "data/dictionary-data.json";
const reviewPath = "data/tag-review.json";
const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const review = JSON.parse(await readFile(reviewPath, "utf8"));
if (bundle.schema !== "prompt-tag-dictionary-runtime-v1" || !Array.isArray(bundle.tags)) throw new Error("Unexpected canonical dictionary schema.");
if (review.schemaVersion !== 1 || !review.entries || typeof review.entries !== "object" || Array.isArray(review.entries)) throw new Error("Unexpected review ledger schema.");
const byTag = new Map(bundle.tags.map(row => [row[0], row]));
for (const [tag, entry] of Object.entries(review.entries)) {
  const row = byTag.get(tag);
  if (!row) throw new Error("Review entry references missing tag: " + tag);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid review entry: " + tag);
  if (row.length < 7) { row[4] = ""; row[5] = []; row[6] = {}; }
  else if (!row[6] || typeof row[6] !== "object" || Array.isArray(row[6])) row[6] = {};
  if (typeof row[4] !== "string") row[4] = "";
  if (!Array.isArray(row[5])) row[5] = [];
  row[6].review = { ...entry };
}
const migrated = bundle.tags.filter(row => row[6]?.review).length;
if (migrated !== Object.keys(review.entries).length) throw new Error("Review migration count mismatch.");
await writeFile(bundlePath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
console.log("Migrated " + migrated + " review records into canonical tag metadata.");
