import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const dataDir = resolve(root, "data");
try {
  await readFile(resolve(dataDir, "master-data.json"), "utf8");
  throw new Error("data/master-data.json already exists. This is a one-time bootstrap script and must not overwrite the canonical master.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const excluded = new Set(["dictionary-data.json", "master-data.json"]);
const names = (await readdir(dataDir)).filter(name => name.endsWith(".json") && !excluded.has(name)).sort();
if (!names.includes("tags.json")) throw new Error("Canonical tags.json is missing.");

const sources = {};
const inventory = [];
for (const name of names) {
  const text = await readFile(resolve(dataDir, name), "utf8");
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (error) { throw new Error(`Invalid JSON in data/${name}: ${error.message}`); }
  sources[name] = parsed;
  inventory.push({ file: name, bytes: Buffer.byteLength(text), topLevel: Array.isArray(parsed) ? "array" : typeof parsed,
    entries: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length });
}
const tags = sources["tags.json"];
if (!Array.isArray(tags) || tags.length !== 10988) {
  throw new Error(`Unexpected tag count: ${Array.isArray(tags) ? tags.length : "not an array"}`);
}
const master = {
  schema: "prompt-tag-dictionary-master-v1",
  description: "辞典プロジェクトのJSON原本をファイル名単位で保持する統合マスター。各セクションの構造・履歴・監査データを変更せず格納する。",
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  generatedAt: new Date().toISOString(),
  inventory,
  sources
};
await writeFile(resolve(dataDir, "master-data.json"), JSON.stringify(master, null, 2) + "\n", "utf8");
console.log(`Wrote master-data.json: ${names.length} source JSON files, ${tags.length} tags.`);
console.log(`Included: ${names.join(", ")}`);
