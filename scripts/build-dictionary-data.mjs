import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const paths = {
  tags: "data/tags.json",
  taxonomy: "data/tag-taxonomy.json",
  promptOrder: "data/prompt-order-categories.json",
  tagGroups: "data/tag-groups.json",
  nsfwAudit: "data/nsfw-prompt-tag-audit.json"
};
const [tags, taxonomy, promptOrder, tagGroups, nsfwAudit] = await Promise.all(
  Object.values(paths).map(readJson)
);
if (!Array.isArray(tags) || taxonomy.schema !== "tag-taxonomy-v1" ||
    !Array.isArray(promptOrder.categories) || !Array.isArray(promptOrder.overrides) ||
    !Array.isArray(tagGroups) || !Array.isArray(nsfwAudit.candidates)) {
  throw new Error("Unexpected source schema; dictionary-data.json was not changed.");
}
const candidateEntries = tags.flatMap(row =>
  Array.isArray(row) && row[6]?.classification
    ? [{ tag: row[0], ...row[6].classification }]
    : []
);
const classificationCandidates = {
  schema: "tag-classification-candidates-v1",
  generatedAt: new Date().toISOString(),
  source: "data/tags.json row[6].classification",
  description: "正本 tags.json に統合された分類候補。status が provisional / needs-review の間は確定分類として扱わない。",
  summary: {
    total: candidateEntries.length,
    provisional: candidateEntries.filter(item => item.status === "provisional").length,
    needsReview: candidateEntries.filter(item => item.status === "needs-review").length
  },
  entries: candidateEntries
};
const generated = {
  schema: "prompt-tag-dictionary-runtime-v1",
  generatedAt: new Date().toISOString().slice(0, 10),
  description: "通常画面が参照するランタイムデータを一元化した配布バンドル。タグ・翻訳候補・分類候補・確認待ちは data/tags.json を正本とする。",
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
  console.log("Wrote data/dictionary-data.json");
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
      console.error("ERROR: runtime dictionary bundle is out of sync with its source files. Run: node scripts/build-dictionary-data.mjs --write");
      process.exitCode = 1;
    } else {
      console.log("Runtime dictionary bundle is up to date.");
      console.log("Tags: " + tags.length);
      console.log("Classification candidates: " + classificationCandidates.entries.length);
      console.log("Tag groups: " + tagGroups.length);
    }
  }
}
