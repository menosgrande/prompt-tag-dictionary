import { readMasterSource } from "./lib/master-data.mjs";
const root = new URL("..", import.meta.url).pathname;
const data = await readMasterSource(root, "prompt-order-categories.json");
if (!Array.isArray(data.categories) || data.categories.length === 0) throw new Error("At least one prompt output category is required.");
const names = data.categories.map(x => x?.name);
if (names[0] !== "品質・ネガティブ") throw new Error("Quality and score category must be first.");
if (names.some(x => typeof x !== "string" || !x.trim()) || new Set(names).size !== names.length) throw new Error("Prompt category names must be non-empty and unique.");
const orders = data.categories.map(x => x.order).sort((a,b)=>a-b);
if (orders.some((x,i)=>x !== i+1)) throw new Error("Prompt category order must be a continuous sequence starting at 1.");
const allowed = new Set(names);
const overrideTags = data.overrides || [];
if (!Array.isArray(overrideTags)) throw new Error("Prompt category overrides must be an array.");
const seen = new Set();
for (const row of overrideTags) {
  if (!row || typeof row.tag !== "string" || !row.tag.trim() || !allowed.has(row.category)) throw new Error("Invalid prompt category override: " + JSON.stringify(row));
  const key = row.tag.normalize("NFKC").toLowerCase();
  if (seen.has(key)) throw new Error("Duplicate prompt category override: " + row.tag);
  seen.add(key);
}
console.log("Prompt output category order OK: " + names.join(" → "));
console.log("Tag overrides: " + overrideTags.length);
