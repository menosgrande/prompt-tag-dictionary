import test from "node:test";
import assert from "node:assert/strict";
import { headers, parseCsv, exportCsv, importCsvData, writeImportOutputs } from "../scripts/import-dictionary-csv.mjs";
import { mkdtemp, readFile, writeFile, rename, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fixture() {
  return {
    tags: [[
      "sample tag", "サンプル", "人物・身体的特徴", "人物属性", "補足情報",
      ["旧別名"],
      {
        translation: { status: "verified", candidateJa: "サンプル", evidence: "保持する根拠" },
        expressionLevel: 2,
        expressionLevelReview: { status: "verified", evidence: "表現レベル根拠" },
        classificationReview: { status: "needs-review", note: "分類メモ" },
        customMetadata: { keep: true }
      }
    ]]
  };
}

function rowsFor(data) {
  return parseCsv(exportCsv(data));
}

function encodeCsv(rows) {
  return rows.map(row => row.map(value => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(",")).join("\n");
}

test("CSV export/import round trip preserves complete canonical row metadata", () => {
  const data = fixture();
  const result = importCsvData(data, exportCsv(data));
  assert.deepEqual(result.data, data);
  assert.equal(result.changed, 0);
});

test("blank detail preserves its value and __CLEAR__ explicitly clears it", () => {
  const data = fixture();
  const rows = rowsFor(data);
  rows[1][5] = "";
  let result = importCsvData(data, encodeCsv(rows));
  assert.equal(result.data.tags[0][4], "補足情報");

  rows[1][5] = "__CLEAR__";
  result = importCsvData(data, encodeCsv(rows));
  assert.equal(result.data.tags[0][4], null);
});

test("blank aliases_json preserves aliases and [] explicitly clears them", () => {
  const data = fixture();
  const rows = rowsFor(data);
  rows[1][6] = "";
  let result = importCsvData(data, encodeCsv(rows));
  assert.deepEqual(result.data.tags[0][5], ["旧別名"]);

  rows[1][6] = "[]";
  result = importCsvData(data, encodeCsv(rows));
  assert.deepEqual(result.data.tags[0][5], []);
});

test("blank review statuses remove only status and retain review evidence", () => {
  const data = fixture();
  const rows = rowsFor(data);
  rows[1][7] = "";
  rows[1][9] = "";
  rows[1][10] = "";
  const result = importCsvData(data, encodeCsv(rows));
  const meta = result.data.tags[0][6];
  assert.equal(meta.translation.status, undefined);
  assert.equal(meta.translation.evidence, "保持する根拠");
  assert.equal(meta.expressionLevelReview.status, undefined);
  assert.equal(meta.expressionLevelReview.evidence, "表現レベル根拠");
  assert.equal(meta.classificationReview.status, undefined);
  assert.equal(meta.classificationReview.note, "分類メモ");
  assert.deepEqual(meta.customMetadata, { keep: true });
});

test("blank expression_level explicitly clears the numeric level", () => {
  const data = fixture();
  const rows = rowsFor(data);
  rows[1][8] = "";
  const result = importCsvData(data, encodeCsv(rows));
  assert.equal(result.data.tags[0][6].expressionLevel, undefined);
});

test("row identity, row width, and invalid aliases JSON are rejected", () => {
  const data = fixture();
  const rows = rowsFor(data);
  rows[1][1] = "different tag";
  assert.throws(() => importCsvData(data, encodeCsv(rows)), /Row identity mismatch/);

  const shortRows = rowsFor(data);
  shortRows[1].pop();
  assert.throws(() => importCsvData(data, encodeCsv(shortRows)), /Column count mismatch/);

  const badAliases = rowsFor(data);
  badAliases[1][6] = "{bad";
  assert.throws(() => importCsvData(data, encodeCsv(badAliases)), /aliases_json is invalid JSON/);
});

test("CSV parser rejects malformed quoted fields", () => {
  assert.throws(() => parseCsv('a,b\n"unterminated,b'), /unterminated quoted field/);
  assert.throws(() => parseCsv('a,b\n"x"tail,y'), /characters after a closing quote/);
});

test("the importer schema remains the documented eleven-column header", () => {
  assert.equal(headers.length, 11);
  assert.deepEqual(headers, [
    "index", "tag", "ja", "major", "minor", "detail", "aliases_json",
    "translation_status", "expression_level", "expression_level_review_status",
    "classification_review_status"
  ]);
});

test("paired output write updates JSON and CSV together", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dictionary-import-"));
  const jsonPath = join(dir, "dictionary.json");
  const csvPath = join(dir, "dictionary.csv");
  try {
    await writeFile(jsonPath, "old-json");
    await writeFile(csvPath, "old-csv");
    await writeImportOutputs(jsonPath, csvPath, "new-json", "new-csv");
    assert.equal(await readFile(jsonPath, "utf8"), "new-json");
    assert.equal(await readFile(csvPath, "utf8"), "new-csv");
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual((await readdir(dir)).sort(), ["dictionary.csv", "dictionary.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("paired output write restores both originals when the second install fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dictionary-import-rollback-"));
  const jsonPath = join(dir, "dictionary.json");
  const csvPath = join(dir, "dictionary.csv");
  let renameCalls = 0;
  const fs = {
    readFile,
    writeFile,
    unlink,
    rename: async (...args) => {
      renameCalls++;
      if (renameCalls === 4) throw new Error("simulated CSV install failure");
      return rename(...args);
    }
  };
  try {
    await writeFile(jsonPath, "old-json");
    await writeFile(csvPath, "old-csv");
    await assert.rejects(
      writeImportOutputs(jsonPath, csvPath, "new-json", "new-csv", fs),
      /simulated CSV install failure/
    );
    assert.equal(await readFile(jsonPath, "utf8"), "old-json");
    assert.equal(await readFile(csvPath, "utf8"), "old-csv");
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual((await readdir(dir)).sort(), ["dictionary.csv", "dictionary.json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
