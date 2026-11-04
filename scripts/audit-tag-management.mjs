import { readFile } from "node:fs/promises";
const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const errors = [];
const review = bundle.review;
const tags = bundle.tags || [];
if (!review || review.schemaVersion !== 1 || !Array.isArray(review.entries) || review.entries.length !== tags.length) {
  errors.push("Packed review index must align one-to-one with canonical tag rows.");
}
let reviewed = 0, translationCounts = {}, classificationCounts = {};
for (let i = 0; i < (review?.entries || []).length; i++) {
  const item = review.entries[i];
  if (item === null) continue;
  reviewed++;
  if (!Array.isArray(item) || item.length !== 5) { errors.push("Invalid review tuple at index " + i); continue; }
  const translation = review.translationStatusCodes?.[item[0]];
  const classification = review.classificationStatusCodes?.[item[1]];
  if (!translation || !classification) errors.push("Unknown review status at index " + i + " (" + tags[i]?.[0] + ")");
  translationCounts[translation] = (translationCounts[translation] || 0) + 1;
  classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
}
console.log("Canonical tag metadata audit");
console.log("Tags indexed: " + tags.length);
console.log("Embedded review records: " + reviewed);
console.log("Translation statuses: " + JSON.stringify(translationCounts));
console.log("Classification statuses: " + JSON.stringify(classificationCounts));
if (errors.length) { for (const error of errors.slice(0, 100)) console.error("ERROR: " + error); process.exitCode = 1; }
else console.log("Audit passed: translation and classification review states are stored in the canonical dictionary.");
