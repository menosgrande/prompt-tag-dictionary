import test from "node:test";
import assert from "node:assert/strict";
import { headers, parseCsv, exportCsv, importCsvData } from "../scripts/import-dictionary-csv.mjs";

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

function csvFor(data) {
  return parseCsv(exportCsv(data));
}

test("CSV export/import round trip preserves the complete canonical row metadata", () => {
  const data = fixture();
  const result = importCsvData(data, exportCsv(data));
  assert.deepEqual(result.data, data);
  assert.equal(result.changed, 0);
});

test("blank detail preserves its value and __CLEAR__ explicitly clears it", () => {
  const data = fixture();
  const rows = csvFor(data);
  rows[1][5] = "";
  let result = importCsvData(data, rows.map(row => row.map(value => value).join(",")).join("\n"));
  assert.equal(result.data.tags[0][4], "補足情報");

  rows[1][5] = "__CLEAR__";
  result = importCsvData(data, rows.map(row => row.map(value => value).join(",")).join("\n"));
  assert.equal(result.data.tags[0][4], null);
});

test("blank aliases_json preserves aliases and [] explicitly clears them", () => {
  const data = fixture();
  const rows = csvFor(data);
  rows[1][6] = "";
  let result = importCsvData(data, rows.map(row => row.map(value => value).join(",")).join("\n"));
  assert.deepEqual(result.data.tags[0][5], ["旧別名"]);

  rows[1][6] = "[]";
  result = importCsvData(data, rows.map(row => row.map(value => value).join(",")).join("\n"));
  assert.deepEqual(result.data.tags[0][5], []);
});

test("blank review statuses remove only status and retain review evidence", () => {
  const data = fixture();
  const rows = csvFor(data);
  rows[1][7] = "";
  rows[1][9] = "";
  rows[1][10] = "";
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(",")).join("\n");
  const result = importCsvData(data, csv);
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
  const rows = csvFor(data);
  rows[1][8] = "";
  const csv = rows.map(row => row.join(",")).join("\n");
  const result = importCsvData(data, csv);
  assert.equal(result.data.tags[0][6].expressionLevel, undefined);
});

test("row identity, row width, and invalid aliases JSON are rejected", () => {
  const data = fixture();
  const rows = csvFor(data);
  rows[1][1] = "different tag";
  assert.throws(() => importCsvData(data, rows.map(row => row.join(",")).join("\n")), /Row identity mismatch/);

  const shortRows = csvFor(data);
  shortRows[1].pop();
  assert.throws(() => importCsvData(data, shortRows.map(row => row.join(",")).join("\n")), /Column count mismatch/);

  const badAliases = csvFor(data);
  badAliases[1][6] = "{bad";
  assert.throws(() => importCsvData(data, badAliases.map(row => row.join(",")).join("\n")), /aliases_json is invalid JSON/);
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
