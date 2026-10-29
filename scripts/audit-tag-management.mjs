import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const tags = await readJson("data/tags.json");
const review = await readJson("data/tag-review.json");
const log = await readJson("data/tag-change-log.json");
const errors = [];
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const tagIndex = new Map();

if (!Array.isArray(tags)) {
  console.error("ERROR: data/tags.json must be an array.");
  process.exit(1);
}
for (const row of tags) {
  if (Array.isArray(row) && typeof row[0] === "string") {
    const key = normalize(row[0]);
    if (!tagIndex.has(key)) tagIndex.set(key, row[0]);
  }
}

const translationStatuses = new Set(review.statuses?.translation ?? []);
const classificationStatuses = new Set(review.statuses?.classification ?? []);
if (review.schemaVersion !== 1 || !review.entries || typeof review.entries !== "object" || Array.isArray(review.entries)) {
  errors.push("tag-review.json: invalid schema or entries object");
} else {
  for (const [tag, entry] of Object.entries(review.entries)) {
    const key = normalize(tag);
    if (!tagIndex.has(key)) errors.push("tag-review.json: unknown tag: " + tag);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("tag-review.json: invalid entry: " + tag);
      continue;
    }
    if (!translationStatuses.has(entry.translationStatus)) errors.push("tag-review.json: invalid translationStatus for " + tag);
    if (!classificationStatuses.has(entry.classificationStatus)) errors.push("tag-review.json: invalid classificationStatus for " + tag);
    if (entry.reviewedAt != null && !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) {
      errors.push("tag-review.json: reviewedAt must be YYYY-MM-DD or null for " + tag);
    }
  }
}

if (log.schemaVersion !== 1 || !Array.isArray(log.changes)) {
  errors.push("tag-change-log.json: invalid schema or changes array");
} else {
  for (let i = 0; i < log.changes.length; i++) {
    const item = log.changes[i];
    const label = "tag-change-log.json changes[" + i + "]";
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(label + ": expected object");
      continue;
    }
    if (typeof item.tag !== "string" || !tagIndex.has(normalize(item.tag))) errors.push(label + ": tag is missing or not in tags.json");
    if (typeof item.changedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.changedAt)) errors.push(label + ": changedAt must be YYYY-MM-DD");
    if (!Array.isArray(item.fields) || item.fields.length === 0 || item.fields.some(field => typeof field !== "string")) errors.push(label + ": fields must be a non-empty string array");
    if (!item.before || typeof item.before !== "object" || Array.isArray(item.before)) errors.push(label + ": before must be an object");
    if (!item.after || typeof item.after !== "object" || Array.isArray(item.after)) errors.push(label + ": after must be an object");
    if (typeof item.reason !== "string" || !item.reason.trim()) errors.push(label + ": reason is required");
    if (!(item.source === null || typeof item.source === "string")) errors.push(label + ": source must be a string or null");
  }
}

console.log("Tag management audit");
console.log("Tags indexed: " + tagIndex.size);
console.log("Reviewed entries: " + Object.keys(review.entries ?? {}).length);
console.log("Change records: " + (log.changes ?? []).length);
if (errors.length) {
  for (const error of errors.slice(0, 100)) console.error("ERROR: " + error);
  if (errors.length > 100) console.error("... and " + (errors.length - 100) + " more errors");
  process.exitCode = 1;
} else {
  console.log("Audit passed: review ledger and change log are structurally consistent.");
}
