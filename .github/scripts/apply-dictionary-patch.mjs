import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataPath = resolve(root, "data/dictionary-data.json");
const patchDir = resolve(root, ".github/patches");
const patchPath = process.argv[2] ? resolve(root, process.argv[2]) : null;
const normalize = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();

let selectedPatch = patchPath;
if (!selectedPatch) {
  const files = (await readdir(patchDir)).filter(name => name.endsWith(".json")).sort();
  if (files.length !== 1) throw new Error("Exactly one JSON patch must be present in .github/patches.");
  selectedPatch = resolve(patchDir, files[0]);
}
const [raw, patchRaw] = await Promise.all([readFile(dataPath, "utf8"), readFile(selectedPatch, "utf8")]);
const patch = JSON.parse(patchRaw);
if (patch.schema !== "prompt-tag-dictionary-patch-v1" || !patch.patch_id || !Array.isArray(patch.operations)) {
  throw new Error("Invalid dictionary patch schema.");
}
const blobSha = createHash("sha1").update(Buffer.concat([
  Buffer.from("blob " + Buffer.byteLength(raw, "utf8") + "\0", "utf8"),
  Buffer.from(raw, "utf8")
])).digest("hex");
if (blobSha !== patch.base_blob_sha) throw new Error("Base blob SHA mismatch; refusing to apply a stale patch. Expected " + patch.base_blob_sha + ", got " + blobSha + ".");
const data = JSON.parse(raw);
if (!Array.isArray(data.tags) || !data.review || !Array.isArray(data.review.entries) || !Array.isArray(data.review.sources)) {
  throw new Error("Canonical dictionary structure is incomplete.");
}
const byTag = new Map();
for (let i = 0; i < data.tags.length; i++) {
  const key = normalize(data.tags[i]?.[0]);
  if (!key || byTag.has(key)) throw new Error("Empty or duplicate normalized tag at row " + i + ".");
  byTag.set(key, { row: data.tags[i], index: i });
}
const unresolved = Array.isArray(data.review.unresolvedSourceReferences) ? data.review.unresolvedSourceReferences : [];
let metadataCount = 0, sourceRefCount = 0;
for (const operation of patch.operations) {
  if (operation.op === "set-tag-metadata") {
    if (operation.field !== "classification") throw new Error("Unsupported metadata field: " + operation.field);
    const hit = byTag.get(normalize(operation.tag));
    if (!hit) throw new Error("Patch tag not found: " + operation.tag);
    if (hit.row[0] !== operation.tag) throw new Error("Tag spelling mismatch for patch target: " + operation.tag);
    if (!hit.row[6] || typeof hit.row[6] !== "object" || Array.isArray(hit.row[6])) hit.row[6] = {};
    hit.row[6].classification = operation.value;
    metadataCount++;
  } else if (operation.op === "preserve-review-source-reference") {
    const index = operation.tagIndex;
    const entry = data.review.entries[index];
    if (!Number.isInteger(index) || index < 0 || index >= data.tags.length ||
        data.tags[index]?.[0] !== operation.tag || !Array.isArray(entry) ||
        entry[4] !== operation.expectedSourceIndex || operation.expectedSourceIndex < data.review.sources.length) {
      throw new Error("Review source-reference precondition failed for " + operation.tag + ".");
    }
    if (unresolved.some(item => item.patchId === patch.patch_id && item.tagIndex === index)) {
      throw new Error("Duplicate unresolved source-reference record for " + operation.tag + ".");
    }
    entry[4] = -1;
    unresolved.push({
      tagIndex: index,
      tag: operation.tag,
      sourceIndex: operation.expectedSourceIndex,
      patchId: patch.patch_id,
      reason: "元の参照番号は保持。対応する出典文字列はreview.sourcesに存在せず、出典内容は未復元。"
    });
    sourceRefCount++;
  } else {
    throw new Error("Unsupported patch operation: " + operation.op);
  }
}
data.review.unresolvedSourceReferences = unresolved;
const embedded = new Map(data.tags.filter(row => row?.[6]?.classification).map(row => [normalize(row[0]), row[6].classification]));
const candidates = data.classificationCandidates?.entries;
if (!Array.isArray(candidates) || embedded.size !== candidates.length) throw new Error("Classification candidate count does not match embedded metadata after patch.");
for (const candidate of candidates) {
  const value = embedded.get(normalize(candidate.tag));
  const expected = Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "tag"));
  if (!value || JSON.stringify(value) !== JSON.stringify(expected)) throw new Error("Classification candidate mismatch after patch: " + candidate.tag);
}
for (let i = 0; i < data.review.entries.length; i++) {
  const entry = data.review.entries[i];
  if (entry !== null && (!Array.isArray(entry) || entry.length !== 5 ||
      !Number.isInteger(entry[4]) || entry[4] < -1 || entry[4] >= data.review.sources.length)) {
    throw new Error("Invalid packed source reference after patch at tag index " + i + ".");
  }
}
await writeFile(dataPath, JSON.stringify(data) + "\n", "utf8");
console.log("Dictionary patch applied.");
console.log("Patch: " + patch.patch_id);
console.log("Classification metadata synchronized: " + metadataCount);
console.log("Unresolved source references preserved: " + sourceRefCount);
console.log("Canonical tags: " + data.tags.length);
