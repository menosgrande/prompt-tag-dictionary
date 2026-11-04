import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { rebuildDictionaryData } from "./lib/rebuild-dictionary-data.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const inputArg = inputIndex >= 0 ? args[inputIndex + 1] : null;
const write = args.includes("--write");
const check = args.includes("--check") || !write;
if (!inputArg || inputArg.startsWith("--")) throw new Error("Usage: node scripts/apply-admin-export.mjs --input <file> [--check|--write]");
if (write && args.includes("--check")) throw new Error("Use either --check or --write, not both.");

const exportData = JSON.parse(await readFile(resolve(inputArg), "utf8"));
const currentPath = resolve(root, "data/dictionary-data.json");
const current = JSON.parse(await readFile(currentPath, "utf8"));
const errors = [];
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
function fingerprint(bundle) {
  const source = JSON.stringify([bundle.tags, bundle.promptOrder]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return "ptd-v1-" + (hash >>> 0).toString(16);
}
if (exportData.schema !== "prompt-tag-admin-bundle-export-v1" || exportData.schemaVersion !== 1) errors.push("Unsupported canonical bundle export schema.");
if (typeof exportData.sourceFingerprint !== "string" || exportData.sourceFingerprint !== fingerprint(current)) errors.push("Source fingerprint mismatch. Reload the admin page and export again; current canonical data has changed.");
const bundle = exportData.bundle;
if (!bundle || bundle.schema !== "prompt-tag-dictionary-runtime-v1" || !Array.isArray(bundle.tags)) errors.push("Export must contain a complete runtime dictionary bundle.");
if (bundle && Array.isArray(bundle.tags)) {
  const seen = new Set();
  const categoryMap = new Map((bundle.taxonomy?.semanticCategories || []).map(category => [category.name, new Set((category.subcategories || []).map(item => item.name))]));
  for (let i = 0; i < bundle.tags.length; i++) {
    const row = bundle.tags[i];
    if (!Array.isArray(row) || ![4, 7].includes(row.length) || row.slice(0, 4).some(value => typeof value !== "string") ||
      (row.length === 7 && (typeof row[4] !== "string" || !Array.isArray(row[5]) || row[5].some(value => typeof value !== "string") || !row[6] || typeof row[6] !== "object" || Array.isArray(row[6])))) {
      errors.push("Invalid tag row at index " + i);
      continue;
    }
    const key = normalize(row[0]);
    if (!key || seen.has(key)) errors.push("Empty or duplicate tag at index " + i + ": " + row[0]);
    seen.add(key);
    if (!(row[2] === "未分類" && row[3] === "未分類") && !categoryMap.get(row[2])?.has(row[3])) errors.push("Unknown category for tag: " + row[0]);
    const review = row[6]?.review;
    if (review && (typeof review !== "object" || Array.isArray(review) ||
      !["unreviewed", "needs-review", "machine-translation", "verified", "not-applicable"].includes(review.translationStatus) ||
      !["unreviewed", "provisional", "needs-review", "verified", "not-applicable"].includes(review.classificationStatus))) {
      errors.push("Invalid embedded review metadata: " + row[0]);
    }
  }
  if (!bundle.promptOrder || !Array.isArray(bundle.promptOrder.categories) || !Array.isArray(bundle.promptOrder.overrides)) errors.push("Invalid prompt order data.");
  else {
    const names = bundle.promptOrder.categories.map(item => item?.name);
    const taxonomyNames = [...(bundle.taxonomy?.semanticCategories || [])].sort((a,b)=>a.order-b.order).map(item=>item.name);
    if (names[0] !== "品質・ネガティブ" || new Set(names).size !== names.length || JSON.stringify(names) !== JSON.stringify(taxonomyNames)) errors.push("Prompt output order must match the canonical taxonomy.");
  }
  const entries = bundle.tags.filter(row => row[6]?.classification).map(row => ({ tag: row[0], ...row[6].classification }));
  const oldSummary = bundle.classificationCandidates?.summary || {};
  bundle.classificationCandidates = {
    schema: "tag-classification-candidates-v1",
    source: "data/dictionary-data.json tags[].metadata.classification",
    description: "タグ行の分類メタデータから導出する索引。独立した正本ではない。",
    summary: {
      total: entries.length,
      provisional: entries.filter(item => item.status === "provisional").length,
      needsReview: entries.filter(item => item.status === "needs-review").length
    },
    entries
  };
  if (oldSummary.total !== undefined && oldSummary.total < 0) errors.push("Invalid classification candidate summary.");
}
if (errors.length) { for (const error of errors) console.error("ERROR: " + error); process.exit(1); }
console.log("Canonical admin export validated.");
console.log("Tags: " + bundle.tags.length + "; embedded review records: " + bundle.tags.filter(row => row[6]?.review).length + "; prompt categories: " + bundle.promptOrder.categories.length);
if (check) { console.log("Check only; no files were changed. Use --write to update data/dictionary-data.json only."); process.exit(0); }

const tempPath = currentPath + ".admin-export.tmp";
const original = await readFile(currentPath);
try {
  await writeFile(tempPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
  await rename(tempPath, currentPath);
  await rebuildDictionaryData(root);
  console.log("Updated data/dictionary-data.json only.");
} catch (error) {
  await writeFile(currentPath, original).catch(() => {});
  await unlink(tempPath).catch(() => {});
  throw new Error("Apply failed; original canonical dictionary was restored where possible. " + error.message);
}
