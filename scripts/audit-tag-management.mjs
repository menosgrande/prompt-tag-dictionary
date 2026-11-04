import { readFile } from "node:fs/promises";
const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const log = JSON.parse(await readFile(new URL("../data/tag-change-log.json", import.meta.url), "utf8"));
const errors = [];
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const tagIndex = new Map();
for (const row of bundle.tags || []) {
  if (Array.isArray(row) && typeof row[0] === "string") {
    const key = normalize(row[0]);
    if (tagIndex.has(key)) errors.push("Duplicate normalized tag: " + row[0]);
    tagIndex.set(key, row);
  }
}
let translationMetadata = 0, classificationMetadata = 0;
for (const row of bundle.tags || []) {
  const meta = row?.[6];
  if (!meta || typeof meta !== "object") continue;
  if (meta.translation) {
    translationMetadata++;
    if (!["unreviewed", "needs-review", "machine-translation", "verified", "not-applicable"].includes(meta.translation.status)) errors.push("Invalid embedded translation status: " + row[0]);
  }
  if (meta.classification) {
    classificationMetadata++;
    if (!["provisional", "needs-review", "verified", "unreviewed"].includes(meta.classification.status)) errors.push("Invalid embedded classification status: " + row[0]);
  }
}
const reviews = bundle.reviews;
if (!reviews || reviews.schemaVersion !== 1 || !reviews.entries || typeof reviews.entries !== "object" ||
    !Array.isArray(reviews.statusCodes?.translation) || !Array.isArray(reviews.statusCodes?.classification) ||
    !Array.isArray(reviews.notes) || !Array.isArray(reviews.sources)) errors.push("Canonical embedded review ledger is invalid.");
else {
  for (const [tag, values] of Object.entries(reviews.entries)) {
    if (!tagIndex.has(normalize(tag))) errors.push("Review entry references missing tag: " + tag);
    if (!Array.isArray(values) || values.length !== 5 ||
        !Number.isInteger(values[0]) || values[0] < 0 || values[0] >= reviews.statusCodes.translation.length ||
        !Number.isInteger(values[1]) || values[1] < 0 || values[1] >= reviews.statusCodes.classification.length ||
        !(values[2] === 0 || typeof values[2] === "string") ||
        !Number.isInteger(values[3]) || values[3] < 0 || values[3] > reviews.notes.length ||
        !Number.isInteger(values[4]) || values[4] < 0 || values[4] > reviews.sources.length) {
      errors.push("Invalid embedded review entry: " + tag);
    }
  }
}
if (log.schemaVersion !== 1 || !Array.isArray(log.changes)) errors.push("tag-change-log.json: invalid schema or changes array");
else for (let i=0;i<log.changes.length;i++) {
  const item=log.changes[i], label="tag-change-log.json changes["+i+"]";
  if (!item || typeof item!=="object" || Array.isArray(item)) { errors.push(label+": expected object"); continue; }
  if (typeof item.tag!=="string" || !item.tag.trim()) errors.push(label+": tag must be non-empty");
  if (typeof item.changedAt!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.changedAt)) errors.push(label+": changedAt must be YYYY-MM-DD");
  if (!Array.isArray(item.fields) || !item.fields.length || item.fields.some(field=>typeof field!=="string")) errors.push(label+": fields must be a non-empty string array");
  if (!item.before || typeof item.before!=="object" || Array.isArray(item.before)) errors.push(label+": before must be an object");
  if (!item.after || typeof item.after!=="object" || Array.isArray(item.after)) errors.push(label+": after must be an object");
  if (typeof item.reason!=="string" || !item.reason.trim()) errors.push(label+": reason is required");
  if (!(item.source===null || typeof item.source==="string")) errors.push(label+": source must be a string or null");
}
console.log("Canonical tag management audit");
console.log("Tags indexed: "+tagIndex.size);
console.log("Embedded translation metadata: "+translationMetadata);
console.log("Embedded classification metadata: "+classificationMetadata);
console.log("Admin review entries: "+Object.keys(reviews?.entries||{}).length);
console.log("Historical change records: "+(log.changes||[]).length);
if(errors.length){for(const error of errors.slice(0,100))console.error("ERROR: "+error);process.exitCode=1;}
else console.log("Audit passed: admin review is embedded in the canonical dictionary; history remains append-only.");
