import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const MASTER_PATH = "data/master-data.json";

export async function readMaster(root) {
  const master = JSON.parse(await readFile(resolve(root, MASTER_PATH), "utf8"));
  if (master.schema !== "prompt-tag-dictionary-master-v1" || !master.sources || typeof master.sources !== "object") {
    throw new Error("Invalid data/master-data.json; refusing to read legacy data as a fallback.");
  }
  return master;
}

export async function readMasterSource(root, filename) {
  const master = await readMaster(root);
  if (!Object.hasOwn(master.sources, filename)) throw new Error("Missing source in master-data.json: " + filename);
  return master.sources[filename];
}

export async function writeMasterSources(root, updates) {
  const master = await readMaster(root);
  for (const [filename, value] of Object.entries(updates)) {
    if (!Object.hasOwn(master.sources, filename)) throw new Error("Cannot add unknown master source: " + filename);
    master.sources[filename] = value;
    const inventory = master.inventory.find(item => item.file === filename);
    if (inventory) {
      const serialized = JSON.stringify(value, null, 2) + "\n";
      inventory.bytes = Buffer.byteLength(serialized);
      inventory.topLevel = Array.isArray(value) ? "array" : typeof value;
      inventory.entries = Array.isArray(value) ? value.length : Object.keys(value).length;
    }
  }
  master.generatedAt = new Date().toISOString();
  await writeFile(resolve(root, MASTER_PATH), JSON.stringify(master, null, 2) + "\n", "utf8");
  return master;
}
