import { readFile } from "node:fs/promises";
const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const log = JSON.parse(await readFile(new URL("../data/tag-change-log.json", import.meta.url), "utf8"));
const errors = [];
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const tagIndex = new Map();
for (const row of bundle.tags || []) {
  if (Array.isArray(row) && typeof row[0] === "string") {
    const key = normalize(row[0]);
    if (!tagIndex.has(key)) tagIndex.set(key, row);
  }
}
let translationMetadata = 0, classificationMetadata = 0;
for (const row of bundle.tags || []) {
  const meta = row?.[6];
  if (!meta || typeof meta !== "object") continue;
  if (meta.translation) {
    translationMetadata++;
    if (!["unreviewed", "needs-review", "machine-translation", "verified", "not-applicable"].includes(meta.translation.status)) {
      errors.push("Invalid embedded translation status: " + row[0]);
    }
  }
  if (meta.classification) {
    classificationMetadata++;
    if (!["provisional", "needs-review", "verified", "unreviewed"].includes(meta.classification.status)) {
      errors.push("Invalid embedded classification status: " + row[0]);
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
console.log("Canonical tag metadata audit");
console.log("Tags indexed: "+tagIndex.size);
console.log("Embedded translation metadata: "+translationMetadata);
console.log("Embedded classification metadata: "+classificationMetadata);
console.log("Historical change records: "+(log.changes||[]).length);
if(errors.length){for(const error of errors.slice(0,100))console.error("ERROR: "+error);process.exitCode=1;}
else console.log("Audit passed: embedded review metadata and historical change log are structurally valid.");
