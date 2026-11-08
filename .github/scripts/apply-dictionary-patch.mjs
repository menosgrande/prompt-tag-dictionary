import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = resolve(root, "data/dictionary-data.json");
const patchPath = process.argv[2] ? resolve(root, process.argv[2]) : null;

if (!patchPath) throw new Error("Patch file path is required.");

const [raw, patchRaw] = await Promise.all([
  readFile(dataPath, "utf8"),
  readFile(patchPath, "utf8")
]);

const data = JSON.parse(raw);
const patch = JSON.parse(patchRaw);

if (!Array.isArray(data.tags)) throw new Error("Canonical tags array is missing.");
if (patch.schema !== "prompt-tag-dictionary-patch-v1" || !Array.isArray(patch.operations)) {
  throw new Error("Invalid patch. Expected schema and operations.");
}

const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
const byTag = new Map();

for (const row of data.tags) {
  const key = normalize(row?.[0]);
  if (!key || byTag.has(key)) throw new Error("Empty or duplicate tag in canonical data: " + row?.[0]);
  byTag.set(key, row);
}

let updated = 0;
let removedArchivedClassificationCandidates = 0;
let packedReviewMerged = 0;
let packedReviewConflicts = 0;

if (patch.cleanup?.mergePackedReviewIntoTagMetadata === true) {
  const review = data.review;
  if (!review || !Array.isArray(review.entries) || review.entries.length !== data.tags.length ||
      !Array.isArray(review.translationStatusCodes) || !Array.isArray(review.classificationStatusCodes) ||
      !Array.isArray(review.notes) || !Array.isArray(review.sources)) {
    throw new Error("Cannot merge packed review: invalid review index or lookup tables.");
  }
  for (let i = 0; i < data.tags.length; i++) {
    const packed = review.entries[i];
    if (packed === null) continue;
    if (!Array.isArray(packed) || packed.length !== 5) throw new Error("Invalid packed review entry at tag index " + i);
    const [translationCode, classificationCode, reviewedAt, noteIndex, sourceIndex] = packed;
    const translationStatus = review.translationStatusCodes[translationCode];
    const classificationStatus = review.classificationStatusCodes[classificationCode];
    if (!translationStatus || !classificationStatus) throw new Error("Unknown packed review status at tag index " + i);
    const row = data.tags[i];
    if (row.length === 4) row.push(null, [], {});
    if (!row[6] || typeof row[6] !== "object" || Array.isArray(row[6])) row[6] = {};
    const meta = row[6];
    if (!meta.translation || typeof meta.translation !== "object" || Array.isArray(meta.translation)) meta.translation = {};
    if (!meta.classificationReview || typeof meta.classificationReview !== "object" || Array.isArray(meta.classificationReview)) meta.classificationReview = {};
    const effectiveClassificationStatus = meta.classification?.status || meta.classificationReview.status;
    if (!meta.translation.status) meta.translation.status = translationStatus;
    else if (meta.translation.status !== translationStatus) packedReviewConflicts++;
    if (!effectiveClassificationStatus) meta.classificationReview.status = classificationStatus;
    else if (effectiveClassificationStatus !== classificationStatus) packedReviewConflicts++;
    if (typeof reviewedAt === "string" && reviewedAt) {
      if (!meta.translation.reviewedAt) meta.translation.reviewedAt = reviewedAt;
      if (!meta.classificationReview.reviewedAt) meta.classificationReview.reviewedAt = reviewedAt;
    }
    const note = Number.isInteger(noteIndex) && noteIndex >= 0 ? review.notes[noteIndex] : null;
    const source = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? review.sources[sourceIndex] : null;
    if (typeof note === "string" && note) {
      if (!meta.translation.reviewNote) meta.translation.reviewNote = note;
      if (!meta.classificationReview.reason) meta.classificationReview.reason = note;
    }
    if (typeof source === "string" && source) {
      if (!meta.translation.source) meta.translation.source = source;
      if (!meta.classificationReview.source) meta.classificationReview.source = source;
    }
    packedReviewMerged++;
  }
  delete data.review;
}

if (patch.cleanup?.removeArchivedClassificationCandidates === true) {
  const candidates = data.classificationCandidates;
  if (!candidates || !Array.isArray(candidates.entries) || !Array.isArray(candidates.archivedEntries)) {
    throw new Error("Cannot remove archived classification candidates: expected entries and archivedEntries arrays.");
  }
  removedArchivedClassificationCandidates = candidates.archivedEntries.length;
  delete candidates.archivedEntries;
  candidates.summary = {
    total: candidates.entries.length,
    provisional: candidates.entries.filter(item => item.status === "provisional").length,
    needsReview: candidates.entries.filter(item => item.status === "needs-review").length,
    archived: 0
  };
}

for (const operation of patch.operations) {
  const row = byTag.get(normalize(operation?.tag));
  if (!row) throw new Error("Tag not found: " + operation?.tag);

  const values = operation.set;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Each operation needs a set object: " + operation.tag);
  }

  const fields = Object.keys(values);
  if (!fields.length || fields.some(field => !["ja", "major", "minor", "candidateJa"].includes(field))) {
    throw new Error("Only ja, major, minor, and candidateJa can be updated: " + operation.tag);
  }

  for (const field of fields) {
    if (field === "candidateJa") {
      if (values[field] !== null && typeof values[field] !== "string") {
        throw new Error("candidateJa must be a string or null: " + operation.tag);
      }
      if (!Array.isArray(row) || row.length !== 7 || !row[6] || typeof row[6] !== "object") {
        throw new Error("Tag has no metadata for candidateJa update: " + operation.tag);
      }
      if (!row[6].translation || typeof row[6].translation !== "object") row[6].translation = {};
      if (values[field] === null) delete row[6].translation.candidateJa;
      else row[6].translation.candidateJa = values[field];
      continue;
    }
    if (typeof values[field] !== "string") {
      throw new Error("Field value must be a string: " + operation.tag + " / " + field);
    }
    const index = field === "ja" ? 1 : field === "major" ? 2 : 3;
    row[index] = values[field];
  }
  updated++;
}

await writeFile(dataPath, JSON.stringify(data) + "\n", "utf8");
console.log("Updated tag entries: " + updated);
console.log("Canonical tags: " + data.tags.length);
if (patch.cleanup?.removeArchivedClassificationCandidates === true) console.log("Removed archived classification candidates: " + removedArchivedClassificationCandidates);
if (patch.cleanup?.mergePackedReviewIntoTagMetadata === true) {
  console.log("Merged packed review records into tag metadata: " + packedReviewMerged);
  console.log("Packed review conflicts resolved in favor of existing tag metadata: " + packedReviewConflicts);
  console.log("Removed duplicate packed review index and lookup tables.");
}
