import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = resolve(root, "data/dictionary-data.json");
const patchPath = process.argv[2] ? resolve(root, process.argv[2]) : null;

if (!patchPath) throw new Error("Patch file path is required.");

const [raw, patchRaw] = await Promise.all([
  readFile(dataPath, "utf8"),
  readFile(patchPath, "utf8")
]);

const data = JSON.parse(raw);
const patch = JSON.parse(patchRaw);

if (!Array.isArray(data.tags)) throw new Error("Canonical tags array is missing.");
if (patch.schema !== "prompt-tag-dictionary-patch-v1" || !Array.isArray(patch.operations)) {
  throw new Error("Invalid patch. Expected schema and operations.");
}

const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const byTag = new Map();

for (const row of data.tags) {
  const key = normalize(row?.[0]);
  if (!key || byTag.has(key)) throw new Error("Empty or duplicate tag in canonical data: " + row?.[0]);
  byTag.set(key, row);
}

let updated = 0;

for (const operation of patch.operations) {
  const row = byTag.get(normalize(operation?.tag));
  if (!row) throw new Error("Tag not found: " + operation?.tag);

  const values = operation.set;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Each operation needs a set object: " + operation.tag);
  }

  const fields = Object.keys(values);
  if (!fields.length || fields.some(field => !["ja", "major", "minor", "candidateJa"].includes(field))) {
    throw new Error("Only ja, major, minor, and candidateJa can be updated: " + operation.tag);
  }

  for (const field of fields) {
    if (field === "candidateJa") {
      if (values[field] !== null && typeof values[field] !== "string") {
        throw new Error("candidateJa must be a string or null: " + operation.tag);
      }
      if (!Array.isArray(row) || row.length !== 7 || !row[6] || typeof row[6] !== "object") {
        throw new Error("Tag has no metadata for candidateJa update: " + operation.tag);
      }
      if (!row[6].translation || typeof row[6].translation !== "object") row[6].translation = {};
      if (values[field] === null) delete row[6].translation.candidateJa;
      else row[6].translation.candidateJa = values[field];
      continue;
    }
    if (typeof values[field] !== "string") {
      throw new Error("Field value must be a string: " + operation.tag + " / " + field);
    }
    const index = field === "ja" ? 1 : field === "major" ? 2 : 3;
    row[index] = values[field];
  }
  updated++;
}

await writeFile(dataPath, JSON.stringify(data) + "\n", "utf8");
console.log("Updated tag entries: " + updated);
console.log("Canonical tags: " + data.tags.length);
