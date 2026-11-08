import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dataPath = resolve(root, "data/dictionary-data.json");
const csvPath = resolve(root, "exports/dictionary-working.csv");
const headers = [
  "index", "tag", "ja", "major", "minor", "detail",
  "aliases_json", "translation_status", "expression_level",
  "expression_level_review_status", "classification_review_status"
];

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") {
      row.push(cell); rows.push(row);
      row = []; cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (rows.length && rows.at(-1).every(value => value === "")) rows.pop();
  return rows;
}

const quoteCsv = value => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

function exportCsv(data) {
  const lines = [headers.join(",")];
  for (let i = 0; i < data.tags.length; i++) {
    const row = data.tags[i], meta = row[6] || {};
    const values = [
      i, row[0], row[1], row[2], row[3], row[4] ?? "",
      row[5] == null ? "" : JSON.stringify(row[5]),
      meta.translation?.status ?? "",
      meta.expressionLevel ?? "",
      meta.expressionLevelReview?.status ?? "",
      meta.classificationReview?.status ?? ""
    ];
    lines.push(values.map(quoteCsv).join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

const [rawData, rawCsv] = await Promise.all([
  readFile(dataPath, "utf8"),
  readFile(csvPath, "utf8")
]);
const data = JSON.parse(rawData);
if (!Array.isArray(data.tags)) throw new Error("Canonical tags array is missing.");

const records = parseCsv(rawCsv);
if (!records.length) throw new Error("CSV is empty.");
if (JSON.stringify(records[0]) !== JSON.stringify(headers)) {
  throw new Error("CSV header does not match the expected schema.");
}
if (records.length - 1 !== data.tags.length) {
  throw new Error("CSV row count mismatch. Expected " + data.tags.length + ", got " + (records.length - 1) + ".");
}

const allowedTranslation = new Set(["verified", "needs-review", "unreviewed"]);
const allowedReview = new Set(["verified", "needs-review", "provisional", "unreviewed"]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ensureExtended = row => {
  if (row.length < 7) {
    row[4] ??= null;
    row[5] ??= null;
    row[6] ??= {};
  }
};

let changed = 0;
const changes = { ja: 0, major: 0, minor: 0, detail: 0, aliases: 0, translationStatus: 0, expressionLevel: 0, expressionReview: 0, classificationReview: 0 };

for (let i = 0; i < data.tags.length; i++) {
  const cells = records[i + 1];
  if (cells.length !== headers.length) throw new Error("Column count mismatch at CSV row " + (i + 2) + ".");
  const row = data.tags[i];
  if (cells[0] !== String(i) || cells[1] !== row[0]) {
    throw new Error("Row identity mismatch at CSV row " + (i + 2) + ". Do not reorder, insert, or delete rows or change the tag column.");
  }

  let rowChanged = false;
  const oldJa = row[1];
  for (const [column, index, key] of [[2, 1, "ja"], [3, 2, "major"], [4, 3, "minor"]]) {
    if (cells[column] !== row[index]) {
      row[index] = cells[column];
      changes[key]++;
      rowChanged = true;
    }
  }

  const detail = cells[5] === "__CLEAR__" ? null : cells[5] === "" ? (row[4] ?? null) : cells[5];
  const detailChanged = !same(row[4] ?? null, detail);
  if (detailChanged) { changes.detail++; rowChanged = true; }

  let aliases = null;
  if (cells[6] !== "") {
    try { aliases = JSON.parse(cells[6]); }
    catch { throw new Error("aliases_json is invalid JSON at tag: " + row[0]); }
    if (!Array.isArray(aliases) || aliases.some(value => typeof value !== "string")) {
      throw new Error("aliases_json must be a JSON array of strings at tag: " + row[0]);
    }
  }
  const aliasesChanged = !same(row[5] ?? null, aliases);
  if (aliasesChanged) { changes.aliases++; rowChanged = true; }

  const originalMeta = row[6] || {};
  const meta = structuredClone(originalMeta);
  let metaChanged = false;

  const translationStatus = cells[7];
  if ((meta.translation?.status ?? "") !== translationStatus) {
    if (translationStatus !== "" && !allowedTranslation.has(translationStatus)) {
      throw new Error("Invalid translation_status at tag: " + row[0]);
    }
    if (translationStatus === "") {
      if (meta.translation) delete meta.translation.status;
    } else {
      meta.translation = { ...(meta.translation || {}), status: translationStatus };
    }
    changes.translationStatus++;
    metaChanged = true;
  }
  if (meta.translation?.candidateJa !== undefined &&
      oldJa !== row[1] && meta.translation.candidateJa !== row[1]) {
    meta.translation.candidateJa = row[1];
    metaChanged = true;
  }

  let expressionLevel = null;
  if (cells[8] !== "") {
    if (!/^[0-4]$/.test(cells[8])) throw new Error("expression_level must be blank or an integer from 0 to 4 at tag: " + row[0]);
    expressionLevel = Number(cells[8]);
  }
  if (!same(meta.expressionLevel ?? null, expressionLevel)) {
    if (expressionLevel === null) delete meta.expressionLevel;
    else meta.expressionLevel = expressionLevel;
    changes.expressionLevel++;
    metaChanged = true;
  }

  const expressionReview = cells[9];
  const beforeExpressionReview = meta.expressionLevelReview?.status ?? "";
  if (beforeExpressionReview !== expressionReview) {
    if (expressionReview === "") delete meta.expressionLevelReview;
    else {
      if (!allowedReview.has(expressionReview)) throw new Error("Invalid expression_level_review_status at tag: " + row[0]);
      meta.expressionLevelReview = { ...(meta.expressionLevelReview || {}), status: expressionReview };
    }
    changes.expressionReview++;
    metaChanged = true;
  }

  const classificationReview = cells[10];
  const beforeClassificationReview = meta.classificationReview?.status ?? "";
  if (beforeClassificationReview !== classificationReview) {
    if (classificationReview === "") delete meta.classificationReview;
    else {
      if (!allowedReview.has(classificationReview)) throw new Error("Invalid classification_review_status at tag: " + row[0]);
      meta.classificationReview = { ...(meta.classificationReview || {}), status: classificationReview };
    }
    changes.classificationReview++;
    metaChanged = true;
  }

  if (metaChanged) rowChanged = true;
  if (detailChanged || aliasesChanged || metaChanged) {
    ensureExtended(row);
    if (detailChanged) row[4] = detail;
    if (aliasesChanged) row[5] = aliases;
    if (metaChanged) row[6] = meta;
  }
  if (rowChanged) changed++;
}

await writeFile(dataPath, JSON.stringify(data) + "\n", "utf8");
await writeFile(csvPath, exportCsv(data), "utf8");
console.log("CSV rows imported: " + data.tags.length);
console.log("Changed tag rows: " + changed);
console.log("Field changes: " + JSON.stringify(changes));
console.log("Canonical metadata and review records preserved.");
