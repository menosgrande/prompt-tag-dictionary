import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const dataPath = resolve(root, "data/dictionary-data.json");
const csvPath = resolve(root, "exports/dictionary-working.csv");
export const headers = [
  "index", "tag", "ja", "major", "minor", "detail",
  "aliases_json", "translation_status", "expression_level",
  "expression_level_review_status", "classification_review_status"
];

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false, afterQuote = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else cell += ch;
      continue;
    }
    if (afterQuote && ch !== "," && ch !== "\n" && ch !== "\r") {
      throw new Error("CSV contains characters after a closing quote.");
    }
    if (ch === '"') {
      if (cell !== "" || afterQuote) throw new Error("CSV contains an unexpected quote.");
      quoted = true;
    } else if (ch === ",") {
      row.push(cell); cell = ""; afterQuote = false;
    } else if (ch === "\n") {
      row.push(cell); rows.push(row);
      row = []; cell = ""; afterQuote = false;
    } else if (ch === "\r") {
      if (source[i + 1] === "\n") continue;
      row.push(cell); rows.push(row);
      row = []; cell = ""; afterQuote = false;
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell !== "" || row.length || afterQuote) { row.push(cell); rows.push(row); }
  if (rows.length && rows.at(-1).every(value => value === "")) rows.pop();
  return rows;
}

const quoteCsv = value => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

export function exportCsv(data) {
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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const allowedTranslation = new Set(["verified", "needs-review", "unreviewed", "machine-translation", "not-applicable"]);
const allowedReview = new Set(["verified", "needs-review", "provisional", "unreviewed", "not-applicable"]);

function setReviewStatus(meta, key, status, allowed, tag, label) {
  const current = meta[key] && typeof meta[key] === "object" ? { ...meta[key] } : {};
  if (status !== "" && !allowed.has(status)) {
    throw new Error("Invalid " + label + " at tag: " + tag);
  }
  if (status === "") delete current.status;
  else current.status = status;
  if (Object.keys(current).length) meta[key] = current;
  else delete meta[key];
}

function resolveClassificationIds(taxonomy, major, minor, tag) {
  const category = taxonomy?.semanticCategories?.find(item => item.name === major);
  const subcategory = category?.subcategories?.find(item => item.name === minor);
  if (!category || !subcategory) {
    throw new Error("Cannot map edited classification to taxonomy at tag: " + tag + " (" + major + " / " + minor + ")");
  }
  return { categoryId: category.id, subcategoryId: subcategory.id };
}

export async function writeImportOutputs(dataPath, csvPath, jsonContent, csvContent, fs = { readFile, writeFile, rename, unlink }) {
  const originals = await Promise.all([
    fs.readFile(dataPath, "utf8"),
    fs.readFile(csvPath, "utf8")
  ]);
  const suffix = ".tmp-" + process.pid + "-" + Date.now();
  const jsonTemp = dataPath + suffix;
  const csvTemp = csvPath + suffix;
  const jsonBackup = dataPath + suffix + ".bak";
  const csvBackup = csvPath + suffix + ".bak";
  let jsonBackedUp = false;
  let csvBackedUp = false;
  let jsonInstalled = false;
  let csvInstalled = false;

  const cleanup = async paths => {
    await Promise.all(paths.map(path => fs.unlink(path).catch(() => {})));
  };

  try {
    await fs.writeFile(jsonTemp, jsonContent, { encoding: "utf8", flag: "wx" });
    await fs.writeFile(csvTemp, csvContent, { encoding: "utf8", flag: "wx" });

    await fs.rename(dataPath, jsonBackup);
    jsonBackedUp = true;
    await fs.rename(csvPath, csvBackup);
    csvBackedUp = true;

    await fs.rename(jsonTemp, dataPath);
    jsonInstalled = true;
    await fs.rename(csvTemp, csvPath);
    csvInstalled = true;

    await cleanup([jsonBackup, csvBackup]);
  } catch (error) {
    const rollbackErrors = [];
    if (jsonBackedUp) {
      try {
        if (jsonInstalled) await fs.unlink(dataPath).catch(() => {});
        await fs.rename(jsonBackup, dataPath);
        jsonBackedUp = false;
      } catch (rollbackError) { rollbackErrors.push("JSON rollback failed: " + rollbackError.message); }
    }
    if (csvBackedUp) {
      try {
        if (csvInstalled) await fs.unlink(csvPath).catch(() => {});
        await fs.rename(csvBackup, csvPath);
        csvBackedUp = false;
      } catch (rollbackError) { rollbackErrors.push("CSV rollback failed: " + rollbackError.message); }
    }
    await cleanup([jsonTemp, csvTemp]);
    if (rollbackErrors.length) {
      throw new Error(error.message + "; " + rollbackErrors.join("; ") +
        "; backup files were retained where restoration failed.");
    }
    throw error;
  }
}

export function importCsvData(data, rawCsv) {
  if (!data || !Array.isArray(data.tags)) throw new Error("Canonical tags array is missing.");
  const records = parseCsv(rawCsv);
  if (!records.length) throw new Error("CSV is empty.");
  if (!same(records[0], headers)) throw new Error("CSV header does not match the expected schema.");
  if (records.length - 1 !== data.tags.length) {
    throw new Error("CSV row count mismatch. Expected " + data.tags.length + ", got " + (records.length - 1) + ".");
  }

  const next = structuredClone(data);
  let changed = 0;
  let classificationMetadataChanged = false;
  const changes = { ja: 0, major: 0, minor: 0, detail: 0, aliases: 0, translationStatus: 0, expressionLevel: 0, expressionReview: 0, classificationReview: 0 };

  for (let i = 0; i < next.tags.length; i++) {
    const cells = records[i + 1];
    if (cells.length !== headers.length) throw new Error("Column count mismatch at CSV row " + (i + 2) + ".");
    const row = next.tags[i];
    if (cells[0] !== String(i) || cells[1] !== row[0]) {
      throw new Error("Row identity mismatch at CSV row " + (i + 2) + ". Do not reorder, insert, or delete rows or change the tag column.");
    }

    let rowChanged = false;
    const oldJa = row[1];
    const oldMajor = row[2];
    const oldMinor = row[3];
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

    // Blank is the exported representation of "no aliases" and means unchanged.
    // Use [] to explicitly clear aliases.
    let aliases = row[5] ?? null;
    if (cells[6] !== "") {
      try { aliases = JSON.parse(cells[6]); }
      catch { throw new Error("aliases_json is invalid JSON at tag: " + row[0]); }
      if (!Array.isArray(aliases) || aliases.some(value => typeof value !== "string")) {
        throw new Error("aliases_json must be a JSON array of strings at tag: " + row[0]);
      }
    }
    const aliasesChanged = !same(row[5] ?? null, aliases);
    if (aliasesChanged) { changes.aliases++; rowChanged = true; }

    const meta = structuredClone(row[6] || {});
    if ((oldMajor !== row[2] || oldMinor !== row[3]) && meta.classification) {
      if ((row[2] === "未分類" && row[3] === "未分類") ||
          (row[2] === "要確認" && row[3] === "要確認")) {
        delete meta.classification;
      } else {
        Object.assign(meta.classification, resolveClassificationIds(next.taxonomy, row[2], row[3], row[0]));
      }
      classificationMetadataChanged = true;
      rowChanged = true;
    }
    const translationStatus = cells[7];
    if ((meta.translation?.status ?? "") !== translationStatus) {
      setReviewStatus(meta, "translation", translationStatus, allowedTranslation, row[0], "translation_status");
      changes.translationStatus++;
      rowChanged = true;
    }
    if (meta.translation?.candidateJa !== undefined &&
        oldJa !== row[1] && meta.translation.candidateJa !== row[1]) {
      meta.translation.candidateJa = row[1];
      rowChanged = true;
    }

    let expressionLevel = meta.expressionLevel ?? null;
    if (cells[8] === "__CLEAR__") {
      expressionLevel = null;
    } else if (cells[8] !== "") {
      if (!/^[0-4]$/.test(cells[8])) throw new Error("expression_level must be blank, __CLEAR__, or an integer from 0 to 4 at tag: " + row[0]);
      expressionLevel = Number(cells[8]);
    }
    if (!same(meta.expressionLevel ?? null, expressionLevel)) {
      if (expressionLevel === null) delete meta.expressionLevel;
      else meta.expressionLevel = expressionLevel;
      changes.expressionLevel++;
      rowChanged = true;
    }

    const expressionReview = cells[9];
    if ((meta.expressionLevelReview?.status ?? "") !== expressionReview) {
      setReviewStatus(meta, "expressionLevelReview", expressionReview, allowedReview, row[0], "expression_level_review_status");
      changes.expressionReview++;
      rowChanged = true;
    }

    const classificationReview = cells[10];
    if ((meta.classificationReview?.status ?? "") !== classificationReview) {
      setReviewStatus(meta, "classificationReview", classificationReview, allowedReview, row[0], "classification_review_status");
      changes.classificationReview++;
      rowChanged = true;
    }

    if (rowChanged) changed++;
    if (detailChanged || aliasesChanged || !same(row[6] || {}, meta)) {
      if (row.length < 7) {
        row[4] ??= null;
        row[5] ??= null;
        row[6] ??= {};
      }
      if (detailChanged) row[4] = detail;
      if (aliasesChanged) row[5] = aliases;
      if (!same(row[6] || {}, meta)) row[6] = meta;
    }
  }

  if (classificationMetadataChanged && next.classificationCandidates &&
      Array.isArray(next.classificationCandidates.entries)) {
    const previousOrder = next.classificationCandidates.entries.map(item => item.tag);
    const byTag = new Map(next.tags
      .filter(row => row[6]?.classification)
      .map(row => [row[0], row[6].classification]));
    const entries = [];
    const included = new Set();
    for (const tag of previousOrder) {
      const classification = byTag.get(tag);
      if (classification) {
        entries.push({ tag, ...structuredClone(classification) });
        included.add(tag);
      }
    }
    for (const [tag, classification] of byTag) {
      if (!included.has(tag)) entries.push({ tag, ...structuredClone(classification) });
    }
    next.classificationCandidates.entries = entries;
  }

  return { data: next, changed, changes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [rawData, rawCsv] = await Promise.all([
    readFile(dataPath, "utf8"),
    readFile(csvPath, "utf8")
  ]);
  let data;
  try { data = JSON.parse(rawData); }
  catch (error) { throw new Error("Canonical dictionary JSON is invalid: " + error.message); }
  const result = importCsvData(data, rawCsv);
  const outputCsv = exportCsv(result.data);
  const checkOnly = process.argv.includes("--check");
  if (!checkOnly) {
    await writeImportOutputs(dataPath, csvPath, JSON.stringify(result.data) + "\n", outputCsv);
  }
  console.log(checkOnly ? "CSV import dry-run passed." : "CSV import completed.");
  console.log("CSV rows checked: " + result.data.tags.length);
  console.log("Changed tag rows: " + result.changed);
  console.log("Field changes: " + JSON.stringify(result.changes));
  console.log("Canonical metadata and review records preserved.");
}
