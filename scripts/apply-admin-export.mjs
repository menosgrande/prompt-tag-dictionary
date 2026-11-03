import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rebuildDictionaryData } from "./lib/rebuild-dictionary-data.mjs";
import { readMaster, writeMasterSources } from "./lib/master-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const inputArg = inputIndex >= 0 ? args[inputIndex + 1] : null;
const write = args.includes("--write");
const check = args.includes("--check") || !write;
if (!inputArg || inputArg.startsWith("--")) throw new Error("Usage: node scripts/apply-admin-export.mjs --input <file> [--check|--write]");
if (write && args.includes("--check")) throw new Error("Use either --check or --write, not both.");
const inputPath = resolve(process.cwd(), inputArg);
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const exportData = JSON.parse(await readFile(inputPath, "utf8"));
const master = await readMaster(root);
const source = name => {
  if (!Object.hasOwn(master.sources, name)) throw new Error("Missing master source: " + name);
  return master.sources[name];
};
const currentTags = source("tags.json");
const currentPromptOrder = source("prompt-order-categories.json");
const currentReview = source("tag-review.json");
const currentLog = source("tag-change-log.json");
function fingerprint(tags, promptOrder, review, log) {
  const source = JSON.stringify([tags, promptOrder, review, log]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return "ptd-v1-" + (hash >>> 0).toString(16);
}
const errors = [];
if (exportData.schema !== "prompt-tag-admin-export-v1" || exportData.schemaVersion !== 1) errors.push("Unsupported export schema.");
if (typeof exportData.sourceFingerprint !== "string" || exportData.sourceFingerprint !== fingerprint(currentTags, currentPromptOrder, currentReview, currentLog)) errors.push("Source fingerprint mismatch. Reload the admin page and export again; current source data has changed.");
if (!Array.isArray(exportData.tags)) errors.push("tags must be an array.");
else {
  const seen = new Set();
  for (let i = 0; i < exportData.tags.length; i++) {
    const row = exportData.tags[i];
    if (!Array.isArray(row) || ![4, 6].includes(row.length) || row.slice(0, 4).some(v => typeof v !== "string") || (row.length === 6 && (typeof row[4] !== "string" || !Array.isArray(row[5]) || row[5].some(v => typeof v !== "string")))) { errors.push("Invalid tag row at index " + i); continue; }
    const key = row[0].normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
    if (!key || seen.has(key)) errors.push("Empty or duplicate tag at index " + i + ": " + row[0]);
    seen.add(key);
  }
}
const review = exportData.review;
if (!review || review.schemaVersion !== 1 || !review.entries || typeof review.entries !== "object" || Array.isArray(review.entries)) errors.push("Invalid review ledger.");
else {
  const known = new Set(exportData.tags.map(row => row[0]));
  const translation = new Set(review.statuses?.translation ?? []), classification = new Set(review.statuses?.classification ?? []);
  for (const [tag, entry] of Object.entries(review.entries)) {
    if (!known.has(tag)) errors.push("Review entry references unknown tag: " + tag);
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !translation.has(entry.translationStatus) || !classification.has(entry.classificationStatus)) errors.push("Invalid review entry: " + tag);
  }
}
const log = exportData.log;
if (!log || log.schemaVersion !== 1 || !Array.isArray(log.changes)) errors.push("Invalid change log.");
else for (let i = 0; i < log.changes.length; i++) {
  const item = log.changes[i];
  if (!item || typeof item !== "object" || typeof item.tag !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.changedAt || "") || !Array.isArray(item.fields) || !item.fields.length || !item.before || typeof item.before !== "object" || !item.after || typeof item.after !== "object" || typeof item.reason !== "string" || !(item.source === null || typeof item.source === "string")) errors.push("Invalid change log entry at index " + i);
}
const promptOrder = exportData.promptOrder;
if (!promptOrder || typeof promptOrder.schema !== "string" || !Array.isArray(promptOrder.categories) || !Array.isArray(promptOrder.overrides)) errors.push("Invalid prompt order data.");
else {
  const names = new Set();
  for (let i = 0; i < promptOrder.categories.length; i++) {
    const item = promptOrder.categories[i];
    if (!item || typeof item.name !== "string" || !item.name.trim() || names.has(item.name) || !Array.isArray(item.subcategories)) errors.push("Invalid or duplicate prompt category at index " + i);
    else names.add(item.name);
  }
}
if (errors.length) { for (const error of errors) console.error("ERROR: " + error); process.exit(1); }
console.log("Admin export validated.");
console.log("Tags: " + exportData.tags.length + "; review entries: " + Object.keys(review.entries).length + "; change records: " + log.changes.length + "; prompt categories: " + promptOrder.categories.length);
if (check) { console.log("Check only; no files were changed. Use --write to apply."); process.exit(0); }
const masterPath = resolve(root, "data/master-data.json");
const bundlePath = resolve(root, "data/dictionary-data.json");
const originals = new Map();
try {
  originals.set(masterPath, await readFile(masterPath));
  originals.set(bundlePath, await readFile(bundlePath));
  await writeMasterSources(root, {
    "tags.json": exportData.tags,
    "tag-review.json": review,
    "tag-change-log.json": log,
    "prompt-order-categories.json": promptOrder
  });
  await rebuildDictionaryData(root);
  console.log("Updated master-data.json and rebuilt data/dictionary-data.json.");
} catch (error) {
  for (const [path, bytes] of originals) await writeFile(path, bytes).catch(() => {});
  throw new Error("Apply failed; master and runtime bundle were restored where possible. " + error.message);
}
} catch (error) {
  for (const [path, bytes] of originals) await writeFile(resolve(root, path), bytes).catch(() => {});
  for (const [temp] of temps) await unlink(temp).catch(() => {});
  throw new Error("Apply failed; original files were restored where possible. " + error.message);
}
