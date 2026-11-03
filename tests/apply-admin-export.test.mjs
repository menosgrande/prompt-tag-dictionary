import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/apply-admin-export.mjs", import.meta.url));
function fingerprint(tags, order, review, log) { const s=JSON.stringify([tags,order,review,log]);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return "ptd-v1-"+(h>>>0).toString(16); }
// The CLI is intentionally exercised against a mismatched fingerprint: it must reject stale exports before writing anything.
test("rejects an export with a stale source fingerprint", async () => {
 const dir=await mkdtemp(join(tmpdir(),"ptd-export-"));
 try {
  const input={schema:"prompt-tag-admin-export-v1",schemaVersion:1,sourceFingerprint:"ptd-v1-stale",tags:[],review:{schemaVersion:1,statuses:{translation:[],classification:[]},entries:{}},log:{schemaVersion:1,changes:[]},promptOrder:{schema:"prompt-order-taxonomy-v1",categories:[],overrides:[]}};
  const file=join(dir,"export.json");await writeFile(file,JSON.stringify(input));
  const result=spawnSync(process.execPath,[script,"--input",file,"--check"],{encoding:"utf8"});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Source fingerprint mismatch/);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
