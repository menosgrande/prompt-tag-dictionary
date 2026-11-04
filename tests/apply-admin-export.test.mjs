import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/apply-admin-export.mjs", import.meta.url));

test("rejects an admin export with a stale canonical source fingerprint", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ptd-export-"));
  try {
    const input = {
      schema: "prompt-tag-admin-export-v2", schemaVersion: 2,
      sourceFingerprint: "ptd-v2-stale",
      dictionary: { schema: "prompt-tag-dictionary-runtime-v1", tags: [] },
      changeLog: { schemaVersion: 1, changes: [] }
    };
    const file = join(dir, "dictionary-data-update.json");
    await writeFile(file, JSON.stringify(input));
    const result = spawnSync(process.execPath, [script, "--input", file, "--check"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stale source data/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
