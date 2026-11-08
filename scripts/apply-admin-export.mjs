import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBundle } from "./build-dictionary-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const inputIndex = args.indexOf("--input");
const inputArg = inputIndex >= 0 ? args[inputIndex + 1] : null;
const write = args.includes("--write");
const check = args.includes("--check") || !write;
if (!inputArg || inputArg.startsWith("--")) throw new Error("Usage: node scripts/apply-admin-export.mjs --input <dictionary-data.json> [--check|--write]");
if (write && args.includes("--check")) throw new Error("Use either --check or --write, not both.");
const inputPath = resolve(process.cwd(), inputArg);
const data = JSON.parse(await readFile(inputPath, "utf8"));
const errors = validateBundle(data);
if (errors.length) {
  for (const error of errors) console.error("ERROR: " + error);
  process.exit(1);
}
console.log("Canonical dictionary export validated.");
console.log("Tags: " + data.tags.length + "; review state stored in tag metadata.");
if (check) {
  console.log("Check only; no files were changed. Use --write to replace data/dictionary-data.json.");
  process.exit(0);
}
const target = resolve(root, "data/dictionary-data.json");
const temp = target + ".admin-export.tmp";
try {
  await writeFile(temp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await rename(temp, target);
  console.log("Updated data/dictionary-data.json only.");
} catch (error) {
  await unlink(temp).catch(() => {});
  throw error;
}
