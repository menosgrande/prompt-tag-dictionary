import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exportCsv } from "./import-dictionary-csv.mjs";

const root = process.cwd();
const dataPath = resolve(root, "data/dictionary-data.json");
const csvPath = resolve(root, "exports/dictionary-working.csv");
const data = JSON.parse(await readFile(dataPath, "utf8"));
if (!data || !Array.isArray(data.tags)) throw new Error("Canonical dictionary tags array is missing.");
await writeFile(csvPath, exportCsv(data), "utf8");
console.log("Working CSV exported from canonical dictionary.");
console.log("CSV rows exported: " + data.tags.length);
