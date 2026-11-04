import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = resolve(root, "data/dictionary-data.json");
const normalizeTag = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();

function validateBundle(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["dictionary-data.json must contain an object."];
  }
  if (data.schema !== "prompt-tag-dictionary-runtime-v1") errors.push("Unknown runtime dictionary schema.");
  if (!Array.isArray(data.tags)) errors.push("tags must be an array.");
  if (!data.taxonomy || data.taxonomy.schema !== "tag-taxonomy-v1" || !Array.isArray(data.taxonomy.semanticCategories)) {
    errors.push("taxonomy must contain a valid tag-taxonomy-v1 schema.");
  }
  if (!data.promptOrder || !Array.isArray(data.promptOrder.categories) || !Array.isArray(data.promptOrder.overrides)) {
    errors.push("promptOrder must contain categories and overrides arrays.");
  }
  if (!Array.isArray(data.tagGroups)) errors.push("tagGroups must be an array.");
  if (!data.nsfwAudit || !Array.isArray(data.nsfwAudit.candidates)) errors.push("nsfwAudit.candidates must be an array.");
  if (!Array.isArray(data.classificationCandidates?.entries)) errors.push("classificationCandidates.entries must be an array.");

  if (Array.isArray(data.tags)) {
    const seen = new Set();
    for (let i = 0; i < data.tags.length; i++) {
      const row = data.tags[i];
      if (!Array.isArray(row) || ![4, 7].includes(row.length) ||
          row.slice(0, 4).some(value => typeof value !== "string") ||
          (row.length === 7 && (typeof row[4] !== "string" || !Array.isArray(row[5]) ||
            row[5].some(value => typeof value !== "string") || !row[6] || typeof row[6] !== "object" || Array.isArray(row[6])))) {
        errors.push("Invalid tag row at index " + i + ".");
        continue;
      }
      const key = normalizeTag(row[0]);
      if (!key) errors.push("Empty tag at index " + i + ".");
      else if (seen.has(key)) errors.push("Normalized duplicate tag: " + row[0]);
      seen.add(key);
    }
  }

  if (Array.isArray(data.taxonomy?.semanticCategories) && Array.isArray(data.promptOrder?.categories)) {
    const taxonomyNames = [...data.taxonomy.semanticCategories].sort((a,b) => a.order - b.order).map(item => item.name);
    const promptNames = [...data.promptOrder.categories].sort((a,b) => a.order - b.order).map(item => item.name);
    if (JSON.stringify(taxonomyNames) !== JSON.stringify(promptNames)) {
      errors.push("Prompt output category order does not match the canonical taxonomy.");
    }
  }

  if (Array.isArray(data.tags) && Array.isArray(data.classificationCandidates?.entries)) {
    const embedded = new Map(data.tags.filter(row => Array.isArray(row) && row[6]?.classification)
      .map(row => [normalizeTag(row[0]), row[6].classification]));
    const candidates = data.classificationCandidates.entries;
    if (embedded.size !== candidates.length) errors.push("classificationCandidates count does not match embedded tag metadata.");
    for (const item of candidates) {
      const source = embedded.get(normalizeTag(item?.tag));
      if (!source || JSON.stringify(source) !== JSON.stringify(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "tag")))) {
        errors.push("Classification candidate is not synchronized with its tag metadata: " + (item?.tag ?? "(missing tag)"));
        break;
      }
    }
  }
  return errors;
}

const args = new Set(process.argv.slice(2));
if (args.has("--write")) {
  throw new Error("The multi-file source generator has been retired. data/dictionary-data.json is the canonical source and must be edited directly; this command is validation-only.");
}
const raw = await readFile(bundlePath, "utf8");
let data;
try { data = JSON.parse(raw); }
catch (error) { throw new Error("data/dictionary-data.json is invalid JSON: " + error.message); }
const errors = validateBundle(data);
if (errors.length) {
  for (const error of errors) console.error("ERROR: " + error);
  process.exitCode = 1;
} else {
  console.log("Canonical runtime dictionary audit passed.");
  console.log("Source: data/dictionary-data.json (single canonical bundle)");
  console.log("Tags: " + data.tags.length);
  console.log("Classification candidates: " + data.classificationCandidates.entries.length);
  console.log("Tag groups: " + data.tagGroups.length);
}
