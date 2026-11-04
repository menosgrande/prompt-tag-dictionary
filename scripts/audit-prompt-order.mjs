import { readFile } from "node:fs/promises";
const data = JSON.parse(await readFile(new URL("../data/dictionary-data.json", import.meta.url), "utf8"));
const order = data.promptOrder, taxonomy = data.taxonomy;
if (!Array.isArray(order?.categories) || !order.categories.length) throw new Error("At least one prompt output category is required.");
const names = order.categories.map(x => x?.name);
if (names[0] !== "品質・ネガティブ") throw new Error("Quality and negative category must be first.");
if (names.some(x => typeof x !== "string" || !x.trim()) || new Set(names).size !== names.length) throw new Error("Prompt category names must be non-empty and unique.");
const orders = order.categories.map(x => x.order).sort((a,b)=>a-b);
if (orders.some((x,i)=>x !== i+1)) throw new Error("Prompt category order must be a continuous sequence starting at 1.");
const taxonomyNames = [...(taxonomy.semanticCategories || [])].sort((a,b)=>a.order-b.order).map(x=>x.name);
if (JSON.stringify(names) !== JSON.stringify(taxonomyNames)) throw new Error("Prompt order must match canonical taxonomy order.");
const allowed = new Set(names), seen = new Set();
if (!Array.isArray(order.overrides)) throw new Error("Prompt category overrides must be an array.");
for (const row of order.overrides) {
  if (!row || typeof row.tag !== "string" || !row.tag.trim() || !allowed.has(row.category)) throw new Error("Invalid prompt category override: " + JSON.stringify(row));
  const key = row.tag.normalize("NFKC").toLowerCase();
  if (seen.has(key)) throw new Error("Duplicate prompt category override: " + row.tag);
  seen.add(key);
}
console.log("Prompt output category order OK: " + names.join(" → "));
console.log("Tag overrides: " + order.overrides.length);
