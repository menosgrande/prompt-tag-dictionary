import { readFile } from "node:fs/promises";
const bundle = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const errors = [];
const tags = bundle.tags || [];
const allowed = new Set(["unreviewed", "needs-review", "verified", "provisional", "machine-translation", "not-applicable"]);
const translationCounts = Object.create(null);
const classificationCounts = Object.create(null);
if (Object.prototype.hasOwnProperty.call(bundle, "review")) errors.push("Obsolete packed review index remains in the canonical dictionary.");
for (let i = 0; i < tags.length; i++) {
  const meta = tags[i]?.[6] || {};
  const translation = meta.translation?.status;
  const classification = meta.classification?.status || meta.classificationReview?.status;
  if (translation !== undefined) {
    if (!allowed.has(translation)) errors.push("Unknown translation status at index " + i);
    translationCounts[translation] = (translationCounts[translation] || 0) + 1;
  }
  if (classification !== undefined) {
    if (!allowed.has(classification)) errors.push("Unknown classification status at index " + i);
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  }
}
console.log("Canonical tag metadata review audit");
console.log("Tags indexed: " + tags.length);
console.log("Translation statuses: " + JSON.stringify(translationCounts));
console.log("Classification statuses: " + JSON.stringify(classificationCounts));
if (errors.length) { for (const error of errors.slice(0, 100)) console.error("ERROR: " + error); process.exitCode = 1; }
else console.log("Audit passed: review states are stored only in per-tag metadata.");
