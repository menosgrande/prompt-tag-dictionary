import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeMasterSources } from "./lib/master-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const updates = {};
for (let n = 1; n <= 12; n++) {
  const filename = "category-audit-candidates-" + String(n).padStart(2, "0") + ".jsonl";
  const text = await readFile(resolve(root, "data", filename), "utf8");
  const rows = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const [meta, ...entries] = rows;
  if (!meta || typeof meta !== "object" || !Array.isArray(entries)) throw new Error("Invalid candidate JSONL: " + filename);
  updates[filename] = { meta, entries };
}
const flagsText = await readFile(resolve(root, "data/category-audit-existing-flags.jsonl"), "utf8");
updates["category-audit-existing-flags.jsonl"] = flagsText.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
await writeMasterSources(root, updates);
console.log("Imported 12 candidate batches and the existing-flags audit into master-data.json.");
for (const [name, value] of Object.entries(updates)) {
  console.log(name + ": " + (Array.isArray(value) ? value.length : value.entries.length) + " records");
}
