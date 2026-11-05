import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = resolve(root, "data/dictionary-data.json");
const normalizeTag = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();

export function validateBundle(data) {
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

  if (!data.review || data.review.schemaVersion !== 1 || !Array.isArray(data.review.entries) || data.review.entries.length !== (Array.isArray(data.tags) ? data.tags.length : -1)) errors.push("review.entries must be an index-aligned array matching tags.");
  if (data.review && (!Array.isArray(data.review.translationStatusCodes) || !Array.isArray(data.review.classificationStatusCodes) || !Array.isArray(data.review.notes) || !Array.isArray(data.review.sources))) errors.push("review status codes, notes, and sources must be arrays.");
  if (Array.isArray(data.review?.entries)) {
    for (let i = 0; i < data.review.entries.length; i++) {
      const entry = data.review.entries[i];
      if (entry === null) continue;
      if (!Array.isArray(entry) || entry.length !== 5 ||
          !Number.isInteger(entry[0]) || entry[0] < 0 || entry[0] >= (data.review.translationStatusCodes || []).length ||
          !Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] >= (data.review.classificationStatusCodes || []).length ||
          !(entry[2] === null || typeof entry[2] === "string") ||
          !Number.isInteger(entry[3]) || entry[3] < -1 || entry[3] >= (data.review.notes || []).length ||
          !Number.isInteger(entry[4]) || entry[4] < -1 || entry[4] >= (data.review.sources || []).length) {
        errors.push("Invalid packed review entry at tag index " + i + ".");
        break;
      }
    }
  }
  if (!data.classificationResearch || typeof data.classificationResearch.entries !== "object" || Array.isArray(data.classificationResearch.entries)) errors.push("classificationResearch.entries must be an object keyed by tag.");
  else for (const [tag, proposals] of Object.entries(data.classificationResearch.entries)) {
    if (!tag.trim() || !Array.isArray(proposals) || proposals.some(item => !item || typeof item !== "object" || typeof item.source !== "string")) {
      errors.push("Invalid classification research record: " + tag);
      break;
    }
  }
  if (!data.externalPromptCandidates || !Array.isArray(data.externalPromptCandidates.candidates)) errors.push("externalPromptCandidates.candidates must be an array.");
  if (!data.sourceInfo || !Array.isArray(data.sourceInfo.inputs) || !Array.isArray(data.sourceInfo.limitations)) errors.push("sourceInfo must retain source inputs and limitations.");

  if (Array.isArray(data.tags)) {
    const seen = new Set();
    for (let i = 0; i < data.tags.length; i++) {
      const row = data.tags[i];
      if (!Array.isArray(row) || ![4, 7].includes(row.length) ||
          row.slice(0, 4).some(value => typeof value !== "string") ||
          (row.length === 7 && !((row[4] === null || typeof row[4] === "string") &&
            (row[5] === null || (Array.isArray(row[5]) && row[5].every(value => typeof value === "string"))) &&
            row[6] && typeof row[6] === "object" && !Array.isArray(row[6])))) {
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has("--write")) throw new Error("This command is validation-only. Edit data/dictionary-data.json directly.");
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
    console.log("Embedded review records: " + data.review.entries.filter(Boolean).length);
  }
}
