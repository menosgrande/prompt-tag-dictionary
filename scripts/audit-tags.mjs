import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const rows = data.tags;
const errors = [], warnings = [], counts = Object.create(null);
const seen = new Map();
let missingJapanese = 0, unclassified = 0, parenthetical = 0, parentheticalUnclassified = 0, classificationMismatch = 0, translationCandidateMismatch = 0, invalidCandidate = 0, halfwidthJapaneseParentheses = 0;
const allowed = new Map((data.taxonomy.semanticCategories || []).map(category =>
  [category.name, new Set((category.subcategories || []).map(item => item.name))]
));
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
function resolveTaxonomyLabels(taxonomy, classification) {
  let categoryId = classification?.categoryId;
  let subcategoryId = classification?.subcategoryId;
  if (categoryId === "person") {
    if (subcategoryId === "people-count") categoryId = "people-count";
    else if (["face-expression", "eyes"].includes(subcategoryId)) categoryId = "face";
    else if (subcategoryId === "hair-head") categoryId = "hair";
  }
  if (classification?.categoryId === "background" && ["furniture", "object-items"].includes(subcategoryId)) categoryId = "objects";
  if (classification?.categoryId === "person" && subcategoryId === "people-count") subcategoryId = "people-count-value";
  else if (classification?.categoryId === "person" && subcategoryId === "face-expression") subcategoryId = "face-expression-core";
  else if (classification?.categoryId === "person" && subcategoryId === "eyes") subcategoryId = "eyes-feature";
  else if (classification?.categoryId === "person" && subcategoryId === "hair-head") subcategoryId = "hair-head-core";
  else if (classification?.categoryId === "background" && subcategoryId === "furniture") subcategoryId = "furniture-items";
  else if (classification?.categoryId === "background" && subcategoryId === "object-items") subcategoryId = "other-objects";
  const category = taxonomy?.semanticCategories?.find(item => item.id === categoryId);
  const subcategory = category?.subcategories?.find(item => item.id === subcategoryId);
  return category && subcategory ? { major: category.name, minor: subcategory.name } : null;
}
if (!Array.isArray(rows)) throw new Error("dictionary-data.json tags must be an array.");
for (let i = 0; i < rows.length; i++) {
  const row = rows[i], label = "tag row " + (i + 1);
  if (!Array.isArray(row) || ![4, 7].includes(row.length) ||
      row.slice(0, 4).some(value => typeof value !== "string") ||
      (row.length === 7 && !((row[4] === null || typeof row[4] === "string") &&
        (row[5] === null || (Array.isArray(row[5]) && row[5].every(value => typeof value === "string"))) &&
        row[6] && typeof row[6] === "object" && !Array.isArray(row[6])))) {
    errors.push(label + ": expected [tag, ja, major, minor] with optional [detail, aliases, metadata]");
    continue;
  }
  const [tag, ja, major, minor] = row;
  const key = normalize(tag);
  if (!key) errors.push(label + ": empty tag");
  if (seen.has(key)) errors.push(label + ": normalized duplicate of row " + seen.get(key) + " (" + tag + ")");
  else seen.set(key, i + 1);
  if ((major === "未分類" && minor === "未分類") || (major === "要確認" && minor === "要確認")) { /* explicit review queue */ }
  else if (!allowed.has(major)) errors.push(label + ': unknown major category "' + major + '"');
  else if (!allowed.get(major).has(minor)) errors.push(label + ': invalid minor category "' + major + " / " + minor + '"');
  counts[major] = (counts[major] || 0) + 1;
  if (!ja.trim()) missingJapanese++;
  if (major === "未分類") unclassified++;
  const classification = row[6]?.classification;
  if (classification?.status === "provisional" && classification.categoryId && classification.subcategoryId) {
    const labels = resolveTaxonomyLabels(data.taxonomy, classification);
    if (!labels || major !== labels.major || minor !== labels.minor) {
      classificationMismatch++;
      errors.push(label + ": row major/minor does not match embedded classification metadata");
    }
  }
  const translation = row[6]?.translation;
  if (translation?.status === "verified" && typeof translation.candidateJa === "string" && translation.candidateJa !== ja) {
    translationCandidateMismatch++;
    errors.push(label + ": verified candidateJa differs from ja");
  }
  if (typeof translation?.candidateJa === "string" &&
      (!translation.candidateJa.trim() || translation.candidateJa.trim() === "要確認")) {
    invalidCandidate++;
    errors.push(label + ": candidateJa is empty or a placeholder");
  }
  if (/[()]/.test(ja) || /[()]/.test(translation?.candidateJa || "")) {
    halfwidthJapaneseParentheses++;
    errors.push(label + ": Japanese translation contains half-width parentheses");
  }
  if (/\\([^)]{1,60}\\)/.test(tag)) { parenthetical++; if (major === "未分類") parentheticalUnclassified++; }
}
console.log("Canonical tag data audit");
console.log("File: data/dictionary-data.json");
console.log("Rows: " + rows.length);
console.log("Missing Japanese: " + missingJapanese);
console.log("Unclassified: " + unclassified);
console.log("Classification metadata mismatches: " + classificationMismatch);
console.log("Verified translation candidate mismatches: " + translationCandidateMismatch);
console.log("Invalid candidateJa placeholders: " + invalidCandidate);
console.log("Half-width Japanese parentheses: " + halfwidthJapaneseParentheses);
console.log("Parenthetical tags: " + parenthetical + " (unclassified: " + parentheticalUnclassified + ")");
for (const [category, count] of Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0],"ja"))) console.log("  " + category + ": " + count);
if (missingJapanese) warnings.push(missingJapanese + " tags have no Japanese label");
if (unclassified) warnings.push(unclassified + " tags remain unclassified");
if (parentheticalUnclassified) warnings.push(parentheticalUnclassified + " parenthetical tags remain unclassified; review rather than auto-classify all parentheses");
for (const warning of warnings) console.warn("WARNING: " + warning);
if (errors.length) { for (const error of errors.slice(0,100)) console.error("ERROR: " + error); process.exitCode = 1; }
else console.log("Audit passed: canonical schema, taxonomy membership, and normalized tag uniqueness are valid.");
