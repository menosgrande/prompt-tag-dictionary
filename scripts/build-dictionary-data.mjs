import { writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readMasterSource } from "./lib/master-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  tags: "tags.json",
  taxonomy: "tag-taxonomy.json",
  classificationCandidates: "tag-classification-candidates.json",
  promptOrder: "prompt-order-categories.json",
  tagGroups: "tag-groups.json",
  nsfwAudit: "nsfw-prompt-tag-audit.json"
};
const [tags, taxonomy, classificationCandidates, promptOrder, tagGroups, nsfwAudit] = await Promise.all(
  Object.values(paths).map(name => readMasterSource(root, name))
);
if (!Array.isArray(tags) || taxonomy.schema !== "tag-taxonomy-v1" ||
    classificationCandidates.schema !== "tag-classification-candidates-v1" ||
    !Array.isArray(classificationCandidates.entries) ||
    !Array.isArray(promptOrder.categories) || !Array.isArray(promptOrder.overrides) ||
    !Array.isArray(tagGroups) || !Array.isArray(nsfwAudit.candidates)) {
  throw new Error("Unexpected master source schema; dictionary-data.json was not changed.");
}
const generated = {
  schema: "prompt-tag-dictionary-runtime-v1",
  generatedAt: new Date().toISOString().slice(0, 10),
  description: "通常画面が参照するランタイムデータを一元化した配布バンドル。監査履歴・未確定候補の原本は個別ファイルに保持する。",
  tags,
  taxonomy,
  classificationCandidates,
  promptOrder,
  tagGroups,
  nsfwAudit
};
const outputPath = resolve(root, "data/dictionary-data.json");
const serialized = JSON.stringify(generated, null, 2) + "\n";
const args = new Set(process.argv.slice(2));
if (args.has("--write")) {
  await writeFile(outputPath, serialized, "utf8");
  console.log("Wrote data/dictionary-data.json from data/master-data.json");
} else {
  const currentText = await readFile(outputPath, "utf8").catch(() => "");
  let current;
  try { current = JSON.parse(currentText); } catch {}
  if (!current) {
    console.error("ERROR: data/dictionary-data.json is missing or invalid. Run with --write.");
    process.exitCode = 1;
  } else {
    const comparable = value => {
      const copy = structuredClone(value);
      delete copy.generatedAt;
      return JSON.stringify(copy);
    };
    if (comparable(current) !== comparable(generated)) {
      console.error("ERROR: runtime dictionary bundle is out of sync with data/master-data.json. Run: node scripts/build-dictionary-data.mjs --write");
      process.exitCode = 1;
    } else {
      console.log("Runtime dictionary bundle is up to date.");
      console.log("Tags: " + tags.length);
      console.log("Classification candidates: " + classificationCandidates.entries.length);
      console.log("Tag groups: " + tagGroups.length);
    }
  }
}
