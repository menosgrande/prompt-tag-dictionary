import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const inputArg = inputIndex >= 0 ? args[inputIndex + 1] : null;
const write = args.includes("--write");
const check = args.includes("--check") || !write;
if (!inputArg || inputArg.startsWith("--")) throw new Error("Usage: node scripts/apply-admin-export.mjs --input <file> [--check|--write]");
if (write && args.includes("--check")) throw new Error("Use either --check or --write, not both.");

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const inputPath = resolve(process.cwd(), inputArg);
const [exportData, currentBundle, currentLog] = await Promise.all([
  readJson(inputPath),
  readJson(resolve(root, "data/dictionary-data.json")),
  readJson(resolve(root, "data/tag-change-log.json"))
]);

function fingerprint(bundle, log) {
  const source = JSON.stringify([bundle.tags, bundle.taxonomy, bundle.promptOrder, bundle.reviews, bundle.tagGroups, bundle.nsfwAudit, log]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return "ptd-v2-" + (hash >>> 0).toString(16);
}
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().trim();
const errors = [];
if (exportData.schema !== "prompt-tag-admin-export-v2" || exportData.schemaVersion !== 2) errors.push("Unsupported admin export schema.");
if (exportData.sourceFingerprint !== fingerprint(currentBundle, currentLog)) errors.push("Export is based on stale source data. Reload admin.html and export again.");
const dictionary = exportData.dictionary;
const changeLog = exportData.changeLog;
if (!dictionary || dictionary.schema !== "prompt-tag-dictionary-runtime-v1") errors.push("Invalid canonical dictionary.");
if (!Array.isArray(dictionary?.tags)) errors.push("Dictionary tags must be an array.");
if (!dictionary?.taxonomy || dictionary.taxonomy.schema !== "tag-taxonomy-v1") errors.push("Dictionary taxonomy is missing or invalid.");
if (!Array.isArray(dictionary?.promptOrder?.categories) || !Array.isArray(dictionary?.promptOrder?.overrides)) errors.push("Invalid prompt order.");
if (!Array.isArray(dictionary?.tagGroups) || !Array.isArray(dictionary?.nsfwAudit?.candidates)) errors.push("Required runtime data is missing.");
if (dictionary?.tags?.length !== currentBundle.tags.length) errors.push("Tag count changed. This admin workflow only edits existing tags; additions and deletions require a separate reviewed migration.");
if (!dictionary?.reviews || dictionary.reviews.schemaVersion !== 1 || !dictionary.reviews.entries || typeof dictionary.reviews.entries !== "object" || Array.isArray(dictionary.reviews.entries)) {
  errors.push("Invalid embedded review data.");
}
if (dictionary?.reviews) {
  const translation = new Set(dictionary.reviews.statusCodes?.translation || []);
  const classification = new Set(dictionary.reviews.statusCodes?.classification || []);
  for (const [tag, values] of Object.entries(dictionary.reviews.entries || {})) {
    if (!Array.isArray(values) || values.length !== 5 || !Number.isInteger(values[0]) || values[0] < 0 || values[0] >= translation.size || !Number.isInteger(values[1]) || values[1] < 0 || values[1] >= classification.size) {
      errors.push("Invalid review entry: " + tag); break;
    }
    if (!dictionary.tags.some(row => normalize(row[0]) === normalize(tag))) {
      errors.push("Review entry references a missing tag: " + tag); break;
    }
  }
}
if (Array.isArray(dictionary?.tags)) {
  const seen = new Set(), allowed = new Map((dictionary.taxonomy?.semanticCategories || []).map(category =>
    [category.name, new Set((category.subcategories || []).map(item => item.name))]
  ));
  for (let i = 0; i < dictionary.tags.length; i++) {
    const row = dictionary.tags[i], label = "tag row " + (i + 1);
    if (!Array.isArray(row) || ![4, 7].includes(row.length) ||
        row.slice(0, 4).some(value => typeof value !== "string") ||
        (row.length === 7 && (typeof row[4] !== "string" || !Array.isArray(row[5]) ||
          row[5].some(value => typeof value !== "string") || !row[6] || typeof row[6] !== "object" || Array.isArray(row[6])))) {
      errors.push(label + ": invalid tag row"); continue;
    }
    const key = normalize(row[0]);
    if (!key || seen.has(key)) errors.push(label + ": empty or duplicate normalized tag " + row[0]);
    seen.add(key);
    if (!(row[2] === "未分類" && row[3] === "未分類") && !allowed.get(row[2])?.has(row[3])) errors.push(label + ": category is outside the canonical taxonomy");
  }
}
const taxonomyNames = [...(dictionary?.taxonomy?.semanticCategories || [])].sort((a,b)=>a.order-b.order).map(item=>item.name);
const promptNames = [...(dictionary?.promptOrder?.categories || [])].sort((a,b)=>a.order-b.order).map(item=>item.name);
if (JSON.stringify(taxonomyNames) !== JSON.stringify(promptNames)) errors.push("Prompt category order does not match taxonomy.");
if (!changeLog || changeLog.schemaVersion !== 1 || !Array.isArray(changeLog.changes)) errors.push("Invalid change history.");
else {
  if (changeLog.changes.length < currentLog.changes.length) errors.push("Historical change records cannot be removed.");
  for (let i = 0; i < currentLog.changes.length; i++) {
    if (JSON.stringify(changeLog.changes[i]) !== JSON.stringify(currentLog.changes[i])) {
      errors.push("Historical change records are append-only; existing record " + i + " was modified."); break;
    }
  }
  for (let i = 0; i < changeLog.changes.length; i++) {
    const item = changeLog.changes[i], label = "changeLog.changes[" + i + "]";
    if (!item || typeof item !== "object" || typeof item.tag !== "string" || !item.tag.trim() ||
        typeof item.changedAt !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(item.changedAt) ||
        !Array.isArray(item.fields) || !item.fields.length ||
        !item.before || typeof item.before !== "object" || !item.after || typeof item.after !== "object" ||
        typeof item.reason !== "string" || !item.reason.trim() ||
        !(item.source === null || typeof item.source === "string")) {
      errors.push(label + ": invalid history record"); break;
    }
  }
}
if (errors.length) {
  for (const error of errors) console.error("ERROR: " + error);
  process.exitCode = 1;
} else {
  console.log("Canonical admin export validation passed.");
  console.log("Tags: " + dictionary.tags.length);
  console.log("Review entries: " + Object.keys(dictionary.reviews.entries).length);
  console.log("Historical change records: " + changeLog.changes.length + " (+" + (changeLog.changes.length - currentLog.changes.length) + ")");
  console.log("Prompt categories: " + dictionary.promptOrder.categories.length);
  if (check) console.log("Check only. No repository files were changed.");
}
if (write && errors.length === 0) {
  const targets = [
    [resolve(root, "data/dictionary-data.json"), JSON.stringify(dictionary, null, 2) + "\n"],
    [resolve(root, "data/tag-change-log.json"), JSON.stringify(changeLog, null, 2) + "\n"]
  ];
  const backups = [];
  const temps = [];
  try {
    for (const [destination, content] of targets) {
      backups.push([destination, await readFile(destination)]);
      const temp = destination + ".admin-export.tmp";
      await writeFile(temp, content, "utf8");
      temps.push([temp, destination]);
    }
    for (const [temp, destination] of temps) await rename(temp, destination);
    console.log("Applied canonical dictionary and append-only change history. No sidecar rebuild was performed.");
  } catch (error) {
    for (const [destination, bytes] of backups) await writeFile(destination, bytes).catch(() => {});
    for (const [temp] of temps) await unlink(temp).catch(() => {});
    throw new Error("Apply failed; original files were restored where possible. " + error.message);
  }
}
