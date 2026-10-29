import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const rows = await readJson("data/tags.json");
const outputPath = resolve(root, "data/translation-audit-candidates.json");
const args = new Set(process.argv.slice(2));

if (!Array.isArray(rows)) {
  console.error("ERROR: data/tags.json must be a JSON array.");
  process.exit(1);
}

function collectCandidates(records) {
  const candidates = [];
  for (const row of records) {
    if (!Array.isArray(row) || row.length !== 4) continue;
    const [tag, rawJa, major, minor] = row;
    const ja = String(rawJa ?? "").trim();
    const reasons = [];
    if (!ja) reasons.push("japanese-translation-missing");
    if (/[A-Za-z]{3,}/.test(ja)) reasons.push("english-remains-in-japanese");
    if (/不条理な|賞賛する|青いアーカイブ|女の子とパンツァー|貧しい女の子の過剰摂取|ニトロ不明/.test(ja)) {
      reasons.push("likely-literal-or-machine-translation");
    }
    if (ja && String(tag).trim().toLocaleLowerCase() === ja.toLocaleLowerCase() && /[A-Za-z]/.test(ja)) {
      reasons.push("same-as-latin-tag");
    }
    if (reasons.length) {
      candidates.push({ tag, ja, major, minor, reasons, status: "needs-review", proposedJa: null });
    }
  }
  return candidates;
}

const candidates = collectCandidates(rows);
const serialized = JSON.stringify(candidates, null, 2) + "\n";
const counts = Object.create(null);
for (const item of candidates) {
  for (const reason of item.reasons) counts[reason] = (counts[reason] || 0) + 1;
}
console.log("Translation audit candidate scan");
console.log("Tags scanned: " + rows.length);
console.log("Candidate records: " + candidates.length);
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
