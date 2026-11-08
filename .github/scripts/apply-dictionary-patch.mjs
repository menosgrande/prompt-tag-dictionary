import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = resolve(root, "data/dictionary-data.json");

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
export const normalizeTag = value =>
  String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();

function validateCanonicalTags(data) {
  if (!isRecord(data) || !Array.isArray(data.tags)) {
    throw new Error("Canonical tags array is missing.");
  }
  const byTag = new Map();
  for (let index = 0; index < data.tags.length; index++) {
    const row = data.tags[index];
    if (!Array.isArray(row) || ![4, 7].includes(row.length) ||
        row.slice(0, 4).some(value => typeof value !== "string") ||
        (row.length === 7 && !isRecord(row[6]))) {
      throw new Error("Invalid canonical tag row at index " + index + ".");
    }
    const key = normalizeTag(row[0]);
    if (!key || byTag.has(key)) {
      throw new Error("Empty or duplicate tag in canonical data: " + row[0]);
    }
    byTag.set(key, row);
  }
  return byTag;
}

function validatePatch(patch, byTag) {
  if (!isRecord(patch) || patch.schema !== "prompt-tag-dictionary-patch-v1" ||
      !Array.isArray(patch.operations)) {
    throw new Error("Invalid patch. Expected schema and operations.");
  }

  const topLevelKeys = Object.keys(patch);
  if (topLevelKeys.some(key => !["schema", "operations", "cleanup"].includes(key))) {
    throw new Error("Patch contains unsupported top-level fields.");
  }

  const cleanup = patch.cleanup ?? {};
  if (!isRecord(cleanup) ||
      Object.keys(cleanup).some(key => !["mergePackedReviewIntoTagMetadata", "removeArchivedClassificationCandidates"].includes(key)) ||
      Object.values(cleanup).some(value => typeof value !== "boolean")) {
    throw new Error("Invalid patch cleanup configuration.");
  }

  const hasCleanup = Object.values(cleanup).some(value => value === true);
  if (patch.operations.length === 0 && !hasCleanup) {
    throw new Error("Patch has no operations or cleanup actions.");
  }

  const seenOperations = new Set();
  const prepared = patch.operations.map((operation, index) => {
    if (!isRecord(operation) || Object.keys(operation).some(key => !["tag", "set"].includes(key)) ||
        typeof operation.tag !== "string" || !operation.tag.trim()) {
      throw new Error("Invalid operation at index " + index + ".");
    }
    const key = normalizeTag(operation.tag);
    if (seenOperations.has(key)) {
      throw new Error("Duplicate patch operation for tag: " + operation.tag);
    }
    seenOperations.add(key);

    const row = byTag.get(key);
    if (!row) throw new Error("Tag not found: " + operation.tag);

    const values = operation.set;
    if (!isRecord(values)) {
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
        if (row.length !== 7 || !isRecord(row[6])) {
          throw new Error("Tag has no metadata for candidateJa update: " + operation.tag);
        }
      } else if (typeof values[field] !== "string") {
        throw new Error("Field value must be a string: " + operation.tag + " / " + field);
      }
    }
    return { row, tag: operation.tag, values };
  });

  if (cleanup.mergePackedReviewIntoTagMetadata === true) {
    const review = null; // The data-dependent validation is performed before applying any operation.
    void review;
  }
  return { prepared, cleanup };
}

function mergePackedReview(data) {
  const review = data.review;
  if (!isRecord(review) || !Array.isArray(review.entries) || review.entries.length !== data.tags.length ||
      !Array.isArray(review.translationStatusCodes) || !Array.isArray(review.classificationStatusCodes) ||
      !Array.isArray(review.notes) || !Array.isArray(review.sources)) {
    throw new Error("Cannot merge packed review: invalid review index or lookup tables.");
  }

  for (let i = 0; i < review.entries.length; i++) {
    const packed = review.entries[i];
    if (packed === null) continue;
    if (!Array.isArray(packed) || packed.length !== 5) {
      throw new Error("Invalid packed review entry at tag index " + i);
    }
    const [translationCode, classificationCode, reviewedAt, noteIndex, sourceIndex] = packed;
    if (typeof review.translationStatusCodes[translationCode] !== "string" ||
        typeof review.classificationStatusCodes[classificationCode] !== "string") {
      throw new Error("Unknown packed review status at tag index " + i);
    }
    if (reviewedAt !== null && reviewedAt !== undefined && typeof reviewedAt !== "string") {
      throw new Error("Invalid packed review date at tag index " + i);
    }
    for (const [label, index, values] of [
      ["note", noteIndex, review.notes],
      ["source", sourceIndex, review.sources]
    ]) {
      if (index !== null && index !== undefined &&
          (!Number.isInteger(index) || index < 0 || index >= values.length || typeof values[index] !== "string")) {
        throw new Error("Invalid packed review " + label + " index at tag index " + i);
      }
    }
  }

  let merged = 0;
  let conflicts = 0;
  for (let i = 0; i < data.tags.length; i++) {
    const packed = review.entries[i];
    if (packed === null) continue;
    const [translationCode, classificationCode, reviewedAt, noteIndex, sourceIndex] = packed;
    const translationStatus = review.translationStatusCodes[translationCode];
    const classificationStatus = review.classificationStatusCodes[classificationCode];
    const row = data.tags[i];
    if (row.length === 4) row.push(null, [], {});
    const meta = row[6];
    if (!isRecord(meta.translation)) meta.translation = {};
    if (!isRecord(meta.classificationReview)) meta.classificationReview = {};
    const effectiveClassificationStatus = meta.classification?.status || meta.classificationReview.status;
    if (!meta.translation.status) meta.translation.status = translationStatus;
    else if (meta.translation.status !== translationStatus) conflicts++;
    if (!effectiveClassificationStatus) meta.classificationReview.status = classificationStatus;
    else if (effectiveClassificationStatus !== classificationStatus) conflicts++;
    if (typeof reviewedAt === "string" && reviewedAt) {
      if (!meta.translation.reviewedAt) meta.translation.reviewedAt = reviewedAt;
      if (!meta.classificationReview.reviewedAt) meta.classificationReview.reviewedAt = reviewedAt;
    }
    const note = Number.isInteger(noteIndex) ? review.notes[noteIndex] : null;
    const source = Number.isInteger(sourceIndex) ? review.sources[sourceIndex] : null;
    if (typeof note === "string" && note) {
      if (!meta.translation.reviewNote) meta.translation.reviewNote = note;
      if (!meta.classificationReview.reason) meta.classificationReview.reason = note;
    }
    if (typeof source === "string" && source) {
      if (!meta.translation.source) meta.translation.source = source;
      if (!meta.classificationReview.source) meta.classificationReview.source = source;
    }
    merged++;
  }
  delete data.review;
  return { merged, conflicts };
}

function removeArchivedCandidates(data) {
  const candidates = data.classificationCandidates;
  if (!isRecord(candidates) || !Array.isArray(candidates.entries) ||
      !Array.isArray(candidates.archivedEntries) ||
      candidates.entries.some(item => !isRecord(item))) {
    throw new Error("Cannot remove archived classification candidates: expected valid entries and archivedEntries arrays.");
  }
  const removed = candidates.archivedEntries.length;
  delete candidates.archivedEntries;
  candidates.summary = {
    total: candidates.entries.length,
    provisional: candidates.entries.filter(item => item.status === "provisional").length,
    needsReview: candidates.entries.filter(item => item.status === "needs-review").length,
    archived: 0
  };
  return removed;
}

export function applyPatchData(inputData, patch) {
  const data = structuredClone(inputData);
  const byTag = validateCanonicalTags(data);
  const { prepared, cleanup } = validatePatch(patch, byTag);

  // Validate all requested cleanup inputs before mutating the cloned dictionary.
  if (cleanup.mergePackedReviewIntoTagMetadata === true) {
    const review = data.review;
    if (!isRecord(review) || !Array.isArray(review.entries) || review.entries.length !== data.tags.length ||
        !Array.isArray(review.translationStatusCodes) || !Array.isArray(review.classificationStatusCodes) ||
        !Array.isArray(review.notes) || !Array.isArray(review.sources)) {
      throw new Error("Cannot merge packed review: invalid review index or lookup tables.");
    }
  }
  if (cleanup.removeArchivedClassificationCandidates === true) {
    const candidates = data.classificationCandidates;
    if (!isRecord(candidates) || !Array.isArray(candidates.entries) ||
        !Array.isArray(candidates.archivedEntries) || candidates.entries.some(item => !isRecord(item))) {
      throw new Error("Cannot remove archived classification candidates: expected valid entries and archivedEntries arrays.");
    }
  }

  let packedReviewMerged = 0;
  let packedReviewConflicts = 0;
  let removedArchivedClassificationCandidates = 0;
  if (cleanup.mergePackedReviewIntoTagMetadata === true) {
    const result = mergePackedReview(data);
    packedReviewMerged = result.merged;
    packedReviewConflicts = result.conflicts;
  }
  if (cleanup.removeArchivedClassificationCandidates === true) {
    removedArchivedClassificationCandidates = removeArchivedCandidates(data);
  }

  for (const { row, tag, values } of prepared) {
    for (const field of Object.keys(values)) {
      if (field === "candidateJa") {
        if (!isRecord(row[6].translation)) row[6].translation = {};
        if (values[field] === null) delete row[6].translation.candidateJa;
        else row[6].translation.candidateJa = values[field];
        continue;
      }
      const index = field === "ja" ? 1 : field === "major" ? 2 : 3;
      row[index] = values[field];
    }
  }

  return {
    data,
    updated: prepared.length,
    packedReviewMerged,
    packedReviewConflicts,
    removedArchivedClassificationCandidates
  };
}

async function writeAtomically(path, content) {
  const tempPath = path + ".tmp-" + process.pid;
  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Patch file path is required.");
  const patchPath = resolve(root, inputPath);
  const relativePatchPath = relative(root, patchPath);
  if (!relativePatchPath || relativePatchPath.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) ||
      isAbsolute(relativePatchPath)) {
    throw new Error("Patch file must be inside the repository.");
  }

  const [raw, patchRaw] = await Promise.all([
    readFile(dataPath, "utf8"),
    readFile(patchPath, "utf8")
  ]);
  let data;
  let patch;
  try { data = JSON.parse(raw); }
  catch (error) { throw new Error("Canonical dictionary is invalid JSON: " + error.message); }
  try { patch = JSON.parse(patchRaw); }
  catch (error) { throw new Error("Patch file is invalid JSON: " + error.message); }

  const result = applyPatchData(data, patch);
  await writeAtomically(dataPath, JSON.stringify(result.data) + "\n");

  console.log("Updated tag entries: " + result.updated);
  console.log("Canonical tags: " + result.data.tags.length);
  if (patch.cleanup?.removeArchivedClassificationCandidates === true) {
    console.log("Removed archived classification candidates: " + result.removedArchivedClassificationCandidates);
  }
  if (patch.cleanup?.mergePackedReviewIntoTagMetadata === true) {
    console.log("Merged packed review records into tag metadata: " + result.packedReviewMerged);
    console.log("Packed review conflicts resolved in favor of existing tag metadata: " + result.packedReviewConflicts);
    console.log("Removed duplicate packed review index and lookup tables.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
