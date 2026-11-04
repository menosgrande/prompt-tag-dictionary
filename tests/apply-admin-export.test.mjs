import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/apply-admin-export.mjs", import.meta.url));
const makeBundle = () => ({
  schema: "prompt-tag-dictionary-runtime-v1",
  tags: [],
  taxonomy: { semanticCategories: [{ name: "品質・ネガティブ", order: 1, subcategories: [] }] },
  promptOrder: { categories: [{ name: "品質・ネガティブ", order: 1, subcategories: [] }], overrides: [] },
  classificationCandidates: { summary: { total: 0 } }
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "ptd-export-"));
  await mkdir(join(dir, "data"));
  await writeFile(join(dir, "data", "dictionary-data.json"), JSON.stringify(makeBundle()));
  return dir;
}
test("rejects stale canonical exports", async () => {
  const dir = await setup();
  const input = { schema: "prompt-tag-admin-bundle-export-v1", schemaVersion: 1, sourceFingerprint: "ptd-v1-stale", bundle: makeBundle() };
  const file = join(dir, "export.json");
  await writeFile(file, JSON.stringify(input));
  const result = spawnSync(process.execPath, [script, "--input", file, "--check"], { cwd: dir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source fingerprint mismatch/);
});
test("check mode validates without modifying the canonical file", async () => {
  const dir = await setup();
  const currentPath = join(dir, "data", "dictionary-data.json");
  const current = JSON.parse(await readFile(currentPath, "utf8"));
  const source = JSON.stringify([current.tags, current.promptOrder]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  const input = { schema: "prompt-tag-admin-bundle-export-v1", schemaVersion: 1, sourceFingerprint: "ptd-v1-" + (hash >>> 0).toString(16), bundle: makeBundle() };
  const file = join(dir, "export.json");
  await writeFile(file, JSON.stringify(input));
  const before = await readFile(currentPath, "utf8");
  const result = spawnSync(process.execPath, [script, "--input", file, "--check"], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Check only; no files were changed/);
  assert.equal(await readFile(currentPath, "utf8"), before);
});
