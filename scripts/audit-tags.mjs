import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = resolve(root, "data/tags.json");
const rows = JSON.parse(await readFile(file, "utf8"));

const categories = {
  "人物": ["人数", "性別・体形", "年齢", "頭髪", "顔・表情", "目", "胸", "身体・部位", "種族・役割"],
  "作品・キャラクター": ["作品名・シリーズ", "キャラクター", "作者・配信者"],
  "背景・場所": ["屋内", "施設", "自然", "都市", "時間・天候"],
  "構図・視点": ["構図", "撮影範囲", "カメラ角度", "視点"],
  "画風・品質": ["画風", "品質", "描写技法", "媒体"],
  "光・色彩": ["照明", "色", "色調"],
  "服装": ["衣類", "靴", "小物", "下着・水着", "装備"],
  "ポーズ・動作": ["姿勢", "行動", "手の動き", "対人動作"],
  "シチュエーション": ["関係性", "日常", "イベント", "成人向け状況"],
  "その他": ["動物", "物", "自然物", "記号・効果"],
  "成人向け": ["身体・衣類", "行為・状況", "表現・修正"],
  "未分類": ["未分類"]
};
const errors = [];
const warnings = [];
const counts = Object.create(null);
const seen = new Map();
let missingJapanese = 0;
let unclassified = 0;
let parenthetical = 0;
let parentheticalUnclassified = 0;

function normalizeTag(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/_/g, " ").trim();
}

if (!Array.isArray(rows)) {
  console.error("ERROR: data/tags.json must contain a JSON array.");
  process.exit(1);
}

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const label = "row " + (i + 1);
  if (!Array.isArray(row) || row.length !== 4) {
    errors.push(label + ": expected [tag, ja, major, minor]");
    continue;
  }
  const [tag, ja, major, minor] = row;
  if ([tag, ja, major, minor].some(value => typeof value !== "string")) {
    errors.push(label + ": all four fields must be strings");
    continue;
  }
  if (!tag.trim()) errors.push(label + ": empty tag");
  const key = normalizeTag(tag);
  if (seen.has(key)) errors.push(label + ": normalized duplicate of row " + seen.get(key) + " (" + tag + ")");
  else seen.set(key, i + 1);

  if (!Object.hasOwn(categories, major)) errors.push(label + ': unknown major category "' + major + '"');
  else if (!categories[major].includes(minor)) errors.push(label + ': invalid minor category "' + major + " / " + minor + '"');

  counts[major] = (counts[major] || 0) + 1;
  if (!ja.trim()) missingJapanese++;
  if (major === "未分類") unclassified++;
  if (/\([^)]{1,60}\)/.test(tag)) {
    parenthetical++;
    if (major === "未分類") parentheticalUnclassified++;
  }
}

console.log("Tag data audit");
console.log("File: data/tags.json");
console.log("Rows: " + rows.length);
console.log("Missing Japanese: " + missingJapanese);
console.log("Unclassified: " + unclassified);
console.log("Parenthetical tags: " + parenthetical + " (unclassified: " + parentheticalUnclassified + ")");
console.log("Category counts:");
for (const [category, count] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], "ja"))) {
  console.log("  " + category + ": " + count);
}
if (missingJapanese) warnings.push(missingJapanese + " tags have no Japanese label");
if (unclassified) warnings.push(unclassified + " tags remain unclassified");
if (parentheticalUnclassified) warnings.push(parentheticalUnclassified + " parenthetical tags remain unclassified; review them rather than auto-classifying all parentheses");
for (const warning of warnings) console.warn("WARNING: " + warning);
if (errors.length) {
  for (const error of errors.slice(0, 100)) console.error("ERROR: " + error);
  if (errors.length > 100) console.error("... and " + (errors.length - 100) + " more errors");
  console.error("Audit failed with " + errors.length + " structural/data-integrity error(s).");
  process.exitCode = 1;
} else {
  console.log("Audit passed: schema, categories, and normalized tag uniqueness are valid.");
}
