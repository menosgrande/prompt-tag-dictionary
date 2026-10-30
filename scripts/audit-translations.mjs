import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));

const KNOWN_MISTRANSLATIONS = new Map([
  ["ace attorney", ["エース弁護士"]],
  ["adventure time", ["冒険の時間"]],
  ["adventurer (ff11)", ["アバター（FF11）"]],
  ["after vaginal", ["膣の後"]],
  ["battle axe", ["戦いx"]],
  ["bb (fate/extra)", ["BB（運命/エクストラ）"]],
  ["blue poison (arknights)", ["青い毒（arknights）"]],
  ["boruto: naruto next generations", ["Boruto：NARUTO-次の世代"]],
  ["breast envy", ["胸のen望"]],
  ["caressing testicles", ["愛sist丸"]],
  ["fate/extra", ["運命/エクストラ"]],
  ["imizu (nitro unknown)", ["イミズ（ニトロ不明）"]],
  ["tamamo no mae (fate/extra)", ["Tamamo no Mae（運命/エクストラ）"]],
  ["yuuji (and)", ["ユウジ（そして）"]],
  [":/", ["歪嘴"]],
  [":|", ["平嘴"]]
]);

const SUSPICIOUS_PATTERNS = [
  /不条理な|賞賛する|青いアーカイブ|女の子とパンツァー|貧しい女の子の過剰摂取|ニトロ不明/,
  /(?:^|[（(])(?:運命\/|次の世代|そして）|エクストラ)/,
  /[A-Za-z]{2,}[ぁ-んァ-ヶ一-龠]|[ぁ-んァ-ヶ一-龠][A-Za-z]{2,}/
];

function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();
}

function classifyTranslation(tag, ja) {
  const reasons = [];
  const normalizedTag = normalize(tag);
  const normalizedJa = normalize(ja);

  if (!normalizedJa) reasons.push("japanese-translation-missing");
  if (KNOWN_MISTRANSLATIONS.get(normalizedTag)?.some(value => normalize(value) === normalizedJa)) {
    reasons.push("known-mistranslation");
  }
  if (/[A-Za-z]{3,}/.test(ja)) reasons.push("english-remains-in-japanese");
  if (/[\u4e00-\u9fff]/.test(ja) && !/[ぁ-んァ-ヶ]/.test(ja) && /歪嘴|平嘴/.test(ja)) {
    reasons.push("possible-chinese-text");
  }
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(ja))) {
    reasons.push("unnatural-or-mixed-script");
  }
  if (ja && normalizedTag === normalizedJa && /[A-Za-z]/.test(ja)) {
    reasons.push("same-as-latin-tag");
  }

  const uniqueReasons = [...new Set(reasons)];
  const confidence = uniqueReasons.includes("known-mistranslation") ? "high"
    : uniqueReasons.some(x => ["japanese-translation-missing", "same-as-latin-tag", "possible-chinese-text", "unnatural-or-mixed-script"].includes(x)) ? "medium"
    : "low";
  return { reasons: uniqueReasons, confidence };
}

export function collectCandidates(records, reviewEntries = {}) {
  const candidates = [];
  for (const row of records) {
    if (!Array.isArray(row) || row.length !== 4 || row.some(value => typeof value !== "string")) continue;
    const [tag, rawJa, major, minor] = row;
    const ja = rawJa.trim();
    const { reasons, confidence } = classifyTranslation(tag, ja);
    if (!reasons.length) continue;
    candidates.push({
      tag, ja, major, minor, reasons, confidence,
      status: reviewEntries[tag]?.translationStatus ?? "unreviewed",
      proposedJa: null
    });
  }
  return candidates;
}

async function main() {
const rows = await readJson("data/tags.json");
const review = await readJson("data/tag-review.json");
const outputPath = resolve(root, "data/translation-audit-candidates.json");
const args = new Set(process.argv.slice(2));

if (!Array.isArray(rows)) {
  console.error("ERROR: data/tags.json must be a JSON array.");
  process.exit(1);
}
if (!review || typeof review.entries !== "object" || Array.isArray(review.entries)) {
  console.error("ERROR: data/tag-review.json entries must be an object.");
  process.exit(1);
}

const candidates = collectCandidates(rows, review.entries);
const serialized = JSON.stringify(candidates, null, 2) + "\n";
const counts = Object.create(null);
const confidenceCounts = Object.create(null);
for (const item of candidates) {
  confidenceCounts[item.confidence] = (confidenceCounts[item.confidence] || 0) + 1;
  for (const reason of item.reasons) counts[item.reasons[0] === reason ? reason : reason] = (counts[reason] || 0) + 1;
}
console.log("Translation quality audit");
console.log("Tags scanned: " + rows.length);
console.log("Candidate records: " + candidates.length);
console.log("Confidence: " + JSON.stringify(confidenceCounts));
for (const [reason, count] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log("  " + reason + ": " + count);
}

if (args.has("--write")) {
  await writeFile(outputPath, serialized, "utf8");
  console.log("Wrote data/translation-audit-candidates.json");
} else {
  const existing = await readFile(outputPath, "utf8").catch(() => "");
  if (existing !== serialized) {
    console.error("ERROR: translation audit report is stale. Run: node scripts/audit-translations.mjs --write");
    process.exitCode = 1;
  } else {
    console.log("Audit report is up to date.");
  }
}

}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
